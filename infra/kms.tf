resource "google_kms_key_ring" "uassist" {
  name     = "uassist"
  location = var.region

  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "user_data_keys" {
  name            = "user-data-keys"
  key_ring        = google_kms_key_ring.uassist.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}
