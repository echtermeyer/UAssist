data "google_project" "this" {
  project_id = var.project_id
}

locals {
  github_repo_lower = lower(var.github_repo)

  # Images flow GitHub Actions → GHCR → Artifact Registry remote (pull-through
  # mirror) → Cloud Run / VM. GHCR stays the source of truth.
  ar_repo_prefix = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.ghcr.repository_id}/${local.github_repo_lower}"

  api_service_name      = "uassist-api"
  frontend_service_name = "uassist-frontend"

  # Cloud Run deterministic URLs — known before the services exist, which
  # breaks the chicken-and-egg between NEXT_PUBLIC_API_URL (baked into the
  # frontend image at build time) and the first deploy.
  api_url      = "https://${local.api_service_name}-${data.google_project.this.number}.${var.region}.run.app"
  frontend_url = "https://${local.frontend_service_name}-${data.google_project.this.number}.${var.region}.run.app"

  vm_internal_ip = "10.10.0.10"
  agent_url      = "http://${local.vm_internal_ip}:8080"
  mongo_host     = "${local.vm_internal_ip}:27017"
}
