package com.jonaslins.curso;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "storage_deletion_jobs")
class StorageDeletionJob {
  @Id UUID id;
  @Column(name = "storage_key", nullable = false, unique = true) String storageKey;
  @Column(nullable = false) int attempts;
  @Column(name = "created_at", nullable = false) Instant createdAt;

  protected StorageDeletionJob() {}

  StorageDeletionJob(String storageKey) {
    this.id = UUID.randomUUID();
    this.storageKey = storageKey;
    this.createdAt = Instant.now();
  }
}
