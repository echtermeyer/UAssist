# Pull-through mirror of ghcr.io — GHCR stays the source of truth for images,
# Cloud Run and the VM pull through Artifact Registry.
resource "google_artifact_registry_repository" "ghcr" {
  location      = var.region
  repository_id = "ghcr"
  format        = "DOCKER"
  mode          = "REMOTE_REPOSITORY"
  description   = "Remote repository mirroring ghcr.io"

  remote_repository_config {
    docker_repository {
      custom_repository {
        uri = "https://ghcr.io"
      }
    }

    upstream_credentials {
      username_password_credentials {
        username                = var.ghcr_username
        password_secret_version = "${google_secret_manager_secret.secrets["ghcr-pull-token"].name}/versions/latest"
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# The Artifact Registry service agent must be able to read the GHCR PAT.
resource "google_project_service_identity" "artifactregistry" {
  provider = google-beta
  service  = "artifactregistry.googleapis.com"

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "ar_reads_ghcr_token" {
  secret_id = google_secret_manager_secret.secrets["ghcr-pull-token"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_project_service_identity.artifactregistry.member
}
