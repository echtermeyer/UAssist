resource "google_service_account" "api_run" {
  account_id   = "sa-api-run"
  display_name = "UAssist API (Cloud Run)"
}

resource "google_service_account" "frontend_run" {
  account_id   = "sa-frontend-run"
  display_name = "UAssist frontend (Cloud Run)"
}

resource "google_service_account" "vm" {
  account_id   = "sa-uassist-vm"
  display_name = "UAssist worker VM"
}

resource "google_service_account" "github_deploy" {
  account_id   = "sa-github-deploy"
  display_name = "GitHub Actions deployer"
}

# ── KMS ────────────────────────────────────────────────────────────────────────
# API encrypts new user keys on signup and decrypts for its own crypto.
resource "google_kms_crypto_key_iam_member" "api_encrypt_decrypt" {
  crypto_key_id = google_kms_crypto_key.user_data_keys.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = google_service_account.api_run.member
}

# The worker-agent on the VM only ever decrypts.
resource "google_kms_crypto_key_iam_member" "vm_decrypt" {
  crypto_key_id = google_kms_crypto_key.user_data_keys.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = google_service_account.vm.member
}

# ── Artifact Registry pulls ────────────────────────────────────────────────────
# Cloud Run pulls images via its service agent, not the runtime SA.
resource "google_artifact_registry_repository_iam_member" "run_agent_reader" {
  location   = google_artifact_registry_repository.ghcr.location
  repository = google_artifact_registry_repository.ghcr.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:service-${data.google_project.this.number}@serverless-robot-prod.iam.gserviceaccount.com"

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "vm_reader" {
  location   = google_artifact_registry_repository.ghcr.location
  repository = google_artifact_registry_repository.ghcr.name
  role       = "roles/artifactregistry.reader"
  member     = google_service_account.vm.member
}

# ── Secret access (scoped per consumer) ────────────────────────────────────────
resource "google_secret_manager_secret_iam_member" "api_secrets" {
  for_each = toset([
    "jwt-secret",
    "admin-pass",
    "mongo-url",
    "mongo-admin-url",
    "smtp-user",
    "smtp-pass",
  ])

  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.api_run.member
}

resource "google_secret_manager_secret_iam_member" "vm_secrets" {
  for_each = toset([
    "mongo-root-password",
    "mongo-api-password",
  ])

  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.vm.member
}

# ── VM observability ───────────────────────────────────────────────────────────
resource "google_project_iam_member" "vm_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = google_service_account.vm.member
}

resource "google_project_iam_member" "vm_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = google_service_account.vm.member
}
