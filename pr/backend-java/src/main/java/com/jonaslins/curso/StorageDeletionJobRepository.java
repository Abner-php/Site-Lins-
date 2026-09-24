package com.jonaslins.curso;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface StorageDeletionJobRepository extends JpaRepository<StorageDeletionJob, UUID> {
  boolean existsByStorageKey(String storageKey);
}
