variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west3"
}

variable "zone" {
  description = "GCP zone for the worker VM"
  type        = string
  default     = "europe-west3-a"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) — used for WIF trust and image paths"
  type        = string
}

variable "ghcr_username" {
  description = "GitHub username used by Artifact Registry to authenticate against ghcr.io"
  type        = string
}

variable "vm_machine_type" {
  description = "Machine type for the worker VM"
  type        = string
  default     = "e2-medium"
}

variable "data_disk_size_gb" {
  description = "Size of the persistent data disk (MongoDB + Docker data root)"
  type        = number
  default     = 50
}
