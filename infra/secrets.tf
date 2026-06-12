# Secret shells only — values are added out-of-band so they never touch
# Terraform state:
#   echo -n '<value>' | gcloud secrets versions add <name> --data-file=-
resource "google_secret_manager_secret" "secrets" {
  for_each = toset([
    "jwt-secret",
    "admin-pass",
    "mongo-root-password",
    "mongo-api-password",
    "mongo-url",       # full URL incl. VM IP + directConnection=true
    "mongo-admin-url", # full URL incl. VM IP + directConnection=true
    "smtp-user",
    "smtp-pass",
    "ghcr-pull-token", # GitHub PAT with read:packages
  ])

  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}
