resource "google_cloud_run_v2_service" "api" {
  name                = local.api_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false # stateless — all state lives on the VM disk

  template {
    service_account = google_service_account.api_run.email

    # SSE streams: Cloud Run's hard ceiling; EventSource reconnects after.
    timeout = "3600s"

    scaling {
      min_instance_count = 1 # keep SSE/change-stream serving warm
      max_instance_count = 2
    }

    vpc_access {
      network_interfaces {
        network    = google_compute_network.uassist.id
        subnetwork = google_compute_subnetwork.run_egress.id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      # Placeholder until the first CI deploy; CI owns the image from then on.
      image = "${local.ar_repo_prefix}/api:latest"

      ports {
        container_port = 3000
      }

      env {
        name  = "KMS_KEY_NAME"
        value = google_kms_crypto_key.user_data_keys.id
      }
      env {
        name  = "AGENT_URL"
        value = local.agent_url
      }
      env {
        name  = "AGENT_AUTH_DISABLED"
        value = "false"
      }
      env {
        name  = "CORS_ORIGIN"
        value = local.frontend_url
      }
      env {
        name  = "COOKIE_SECURE"
        value = "true"
      }
      env {
        name  = "COOKIE_SAMESITE"
        value = "none"
      }

      dynamic "env" {
        for_each = {
          MONGO_URL       = "mongo-url"
          MONGO_ADMIN_URL = "mongo-admin-url"
          JWT_SECRET      = "jwt-secret"
          ADMIN_PASS      = "admin-pass"
          SMTP_USER       = "smtp-user"
          SMTP_PASS       = "smtp-pass"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.api_secrets,
    google_artifact_registry_repository_iam_member.run_agent_reader,
  ]
}

resource "google_cloud_run_v2_service" "frontend" {
  name                = local.frontend_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.frontend_run.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = "${local.ar_repo_prefix}/frontend:latest"

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_artifact_registry_repository_iam_member.run_agent_reader]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
