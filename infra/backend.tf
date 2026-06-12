# State bucket is supplied at init time so the bucket name stays out of the
# repo:  terraform init -backend-config="bucket=<your-tf-state-bucket>"
terraform {
  backend "gcs" {
    prefix = "uassist"
  }
}
