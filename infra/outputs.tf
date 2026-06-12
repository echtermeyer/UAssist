output "api_url" {
  description = "Deterministic Cloud Run URL of the API (set as NEXT_PUBLIC_API_URL repo variable)"
  value       = local.api_url
}

output "frontend_url" {
  description = "Deterministic Cloud Run URL of the frontend"
  value       = local.frontend_url
}

output "vm_internal_ip" {
  description = "Internal IP of the worker VM (MongoDB + worker-agent)"
  value       = local.vm_internal_ip
}

output "ar_repo_prefix" {
  description = "Artifact Registry pull-through prefix for GHCR images"
  value       = local.ar_repo_prefix
}

output "kms_key_name" {
  description = "Cloud KMS key resource name (KMS_KEY_NAME env var)"
  value       = google_kms_crypto_key.user_data_keys.id
}

output "wif_provider" {
  description = "Workload Identity provider for google-github-actions/auth (GCP_WIF_PROVIDER repo variable)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Service account GitHub Actions impersonates (GCP_DEPLOY_SA repo variable)"
  value       = google_service_account.github_deploy.email
}

output "mongo_url_example" {
  description = "Value shape for the mongo-url secret (replace the password)"
  value       = "mongodb://uassist_api:<mongo-api-password>@${local.mongo_host}/?authSource=admin&directConnection=true"
}

output "mongo_admin_url_example" {
  description = "Value shape for the mongo-admin-url secret (replace the password)"
  value       = "mongodb://mongoadmin:<mongo-root-password>@${local.mongo_host}/?authSource=admin&directConnection=true"
}
