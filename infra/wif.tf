# Workload Identity Federation: GitHub Actions deploys without any static
# service-account keys. Only workflows from this exact repository can
# impersonate the deploy SA.
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Deploy new Cloud Run revisions.
resource "google_project_iam_member" "deploy_run" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = google_service_account.github_deploy.member
}

resource "google_service_account_iam_member" "deploy_acts_as_api" {
  service_account_id = google_service_account.api_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.github_deploy.member
}

resource "google_service_account_iam_member" "deploy_acts_as_frontend" {
  service_account_id = google_service_account.frontend_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.github_deploy.member
}

# Needed for the post-deploy worker image refresh:
# gcloud compute ssh --tunnel-through-iap → curl the agent on localhost.
resource "google_project_iam_member" "deploy_iap_tunnel" {
  project = var.project_id
  role    = "roles/iap.tunnelResourceAccessor"
  member  = google_service_account.github_deploy.member
}

resource "google_project_iam_member" "deploy_compute_viewer" {
  project = var.project_id
  role    = "roles/compute.viewer"
  member  = google_service_account.github_deploy.member
}

resource "google_project_iam_member" "deploy_os_login" {
  project = var.project_id
  role    = "roles/compute.osAdminLogin"
  member  = google_service_account.github_deploy.member
}
