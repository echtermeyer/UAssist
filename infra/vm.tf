# Reserved internal IP so AGENT_URL / Mongo URLs are stable.
resource "google_compute_address" "vm" {
  name         = "uassist-vm"
  address_type = "INTERNAL"
  subnetwork   = google_compute_subnetwork.vm.id
  address      = local.vm_internal_ip
  region       = var.region
}

# Holds MongoDB data AND the Docker data root (tenant session volumes), so
# everything stateful survives VM recreation and is covered by snapshots.
resource "google_compute_disk" "data" {
  name = "uassist-data"
  type = "pd-balanced"
  zone = var.zone
  size = var.data_disk_size_gb

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_compute_resource_policy" "daily_snapshot" {
  name   = "uassist-daily-snapshot"
  region = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "03:00"
      }
    }

    retention_policy {
      max_retention_days    = 14
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }
  }
}

resource "google_compute_disk_resource_policy_attachment" "data_snapshot" {
  name = google_compute_resource_policy.daily_snapshot.name
  disk = google_compute_disk.data.name
  zone = var.zone
}

resource "google_compute_instance" "vm" {
  name         = "uassist-vm"
  machine_type = var.vm_machine_type
  zone         = var.zone
  tags         = ["uassist-vm"]

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = "mongo-data"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.vm.id
    network_ip = google_compute_address.vm.address
    # No access_config block → no external IP; egress goes through Cloud NAT.
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
    user-data = templatefile("${path.module}/cloud-init/cloud-init.yaml.tftpl", {
      project_id          = var.project_id
      registry_host       = "${var.region}-docker.pkg.dev"
      ar_repo_prefix      = local.ar_repo_prefix
      kms_key_name        = google_kms_crypto_key.user_data_keys.id
      tenant_worker_image = "${local.ar_repo_prefix}/tenant-worker:latest"
      allowed_sa_email    = google_service_account.api_run.email
      agent_audience      = local.agent_url
    })
  }

  depends_on = [google_compute_router_nat.uassist]
}
