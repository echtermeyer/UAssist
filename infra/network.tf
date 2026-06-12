resource "google_compute_network" "uassist" {
  name                    = "uassist"
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "vm" {
  name                     = "uassist-vm"
  network                  = google_compute_network.uassist.id
  region                   = var.region
  ip_cidr_range            = "10.10.0.0/24"
  private_ip_google_access = true
}

# Dedicated subnet for Cloud Run direct VPC egress.
resource "google_compute_subnetwork" "run_egress" {
  name          = "uassist-run-egress"
  network       = google_compute_network.uassist.id
  region        = var.region
  ip_cidr_range = "10.10.1.0/26"
}

# The VM has no external IP; NAT provides outbound connectivity for the
# tenant workers (WhatsApp, Signal, IMAP, Slack) and image pulls.
resource "google_compute_router" "uassist" {
  name    = "uassist"
  network = google_compute_network.uassist.id
  region  = var.region
}

resource "google_compute_router_nat" "uassist" {
  name                               = "uassist"
  router                             = google_compute_router.uassist.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.vm.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
}

# Only the API (via its egress subnet) may reach MongoDB and the worker-agent.
resource "google_compute_firewall" "api_to_vm" {
  name    = "uassist-allow-api-to-vm"
  network = google_compute_network.uassist.id

  allow {
    protocol = "tcp"
    ports    = ["27017", "8080"]
  }

  source_ranges = [google_compute_subnetwork.run_egress.ip_cidr_range]
  target_tags   = ["uassist-vm"]
}

# SSH only through IAP (no public SSH exposure).
resource "google_compute_firewall" "iap_ssh" {
  name    = "uassist-allow-iap-ssh"
  network = google_compute_network.uassist.id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["uassist-vm"]
}
