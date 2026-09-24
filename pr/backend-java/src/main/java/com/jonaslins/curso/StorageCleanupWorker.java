package com.jonaslins.curso;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class StorageCleanupWorker {
  private final StorageDeletionJobRepository jobs;
  private final VideoStorageService storage;

  StorageCleanupWorker(StorageDeletionJobRepository jobs, VideoStorageService storage) {
    this.jobs = jobs;
    this.storage = storage;
  }

  @Scheduled(fixedDelayString = "${app.storage.cleanup-delay-ms:60000}")
  @Transactional
  void cleanPendingFiles() {
    for (StorageDeletionJob job : jobs.findAll()) {
      try {
        storage.delete(job.storageKey);
        jobs.delete(job);
      } catch (RuntimeException error) {
        job.attempts++;
        jobs.save(job);
      }
    }
  }
}
