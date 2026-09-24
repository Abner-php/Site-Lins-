package com.jonaslins.curso;

import jakarta.persistence.EntityManager;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
class ModuleService {
  private final ModuleRepository modules;
  private final StorageDeletionJobRepository deletionJobs;
  private final VideoStorageService storage;
  private final EntityManager entityManager;

  ModuleService(ModuleRepository modules, StorageDeletionJobRepository deletionJobs,
                VideoStorageService storage, EntityManager entityManager) {
    this.modules = modules;
    this.deletionJobs = deletionJobs;
    this.storage = storage;
    this.entityManager = entityManager;
  }

  @Transactional(readOnly = true)
  List<Module> list(UUID courseId) { return modules.findByCourseIdOrderByPositionAsc(courseId); }

  @Transactional
  Module create(UUID courseId, String title, String description) {
    Module module = new Module();
    module.courseId = courseId;
    module.position = modules.findLastPosition(courseId) + 1;
    applyText(module, title, description);
    return modules.save(module);
  }

  @Transactional
  Module update(UUID id, String title, String description) {
    Module module = get(id);
    applyText(module, title, description);
    return modules.save(module);
  }

  @Transactional
  Module publish(UUID id, boolean published) {
    Module module = get(id);
    if (published && (!"READY".equals(module.videoUploadStatus) || module.videoStorageKey == null))
      throw new IllegalArgumentException("Envie um vídeo válido antes de publicar o módulo.");
    module.published = published;
    return modules.save(module);
  }

  @Transactional
  void reorder(UUID courseId, List<UUID> orderedIds) {
    List<Module> current = modules.findByCourseIdOrderByPositionAsc(courseId);
    Set<UUID> expected = new HashSet<>(current.stream().map(module -> module.id).toList());
    if (orderedIds == null || orderedIds.size() != current.size() || orderedIds.size() != new HashSet<>(orderedIds).size() || !expected.equals(new HashSet<>(orderedIds)))
      throw new IllegalArgumentException("A ordenação deve conter todos os módulos do curso uma única vez.");

    entityManager.createNativeQuery("update modules set position = position + 100000 where course_id = :courseId")
      .setParameter("courseId", courseId).executeUpdate();
    for (int index = 0; index < orderedIds.size(); index++) {
      entityManager.createNativeQuery("update modules set position = :position, updated_at = now() where id = :id and course_id = :courseId")
        .setParameter("position", index + 1).setParameter("id", orderedIds.get(index)).setParameter("courseId", courseId).executeUpdate();
    }
    entityManager.clear();
  }

  @Transactional
  Module uploadVideo(UUID id, MultipartFile file) {
    Module module = get(id);
    VideoStorageService.StoredVideo stored = storage.store(file);
    registerRollbackCleanup(stored.key());
    queueDeletion(module.videoStorageKey);
    module.videoStorageKey = stored.key();
    module.videoOriginalName = stored.originalName();
    module.videoContentType = stored.contentType();
    module.videoSizeBytes = stored.sizeBytes();
    module.videoUploadStatus = "READY";
    module.videoUrl = "/api/modules/" + module.id + "/video";
    return modules.save(module);
  }

  @Transactional
  Module deleteVideo(UUID id) {
    Module module = get(id);
    queueDeletion(module.videoStorageKey);
    module.published = false;
    module.videoStorageKey = null;
    module.videoOriginalName = null;
    module.videoContentType = null;
    module.videoSizeBytes = null;
    module.videoUploadStatus = "NONE";
    module.videoUrl = null;
    return modules.save(module);
  }

  @Transactional
  void delete(UUID id) {
    Module module = get(id);
    UUID courseId = module.courseId;
    queueDeletion(module.videoStorageKey);
    modules.delete(module);
    modules.flush();
    List<Module> remaining = modules.findByCourseIdOrderByPositionAsc(courseId);
    for (int index = 0; index < remaining.size(); index++) remaining.get(index).position = index + 1;
    modules.saveAll(remaining);
  }

  private Module get(UUID id) {
    return modules.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Módulo não encontrado."));
  }

  private void applyText(Module module, String title, String description) {
    String cleanTitle = title == null ? "" : title.trim();
    String cleanDescription = description == null ? "" : description.trim();
    if (cleanTitle.length() < 3 || cleanTitle.length() > 160) throw new IllegalArgumentException("O título deve ter entre 3 e 160 caracteres.");
    if (cleanDescription.length() > 3000) throw new IllegalArgumentException("A descrição deve ter no máximo 3000 caracteres.");
    module.title = cleanTitle;
    module.description = cleanDescription;
  }

  private void queueDeletion(String storageKey) {
    if (storageKey != null && !storageKey.isBlank() && !deletionJobs.existsByStorageKey(storageKey))
      deletionJobs.save(new StorageDeletionJob(storageKey));
  }

  private void registerRollbackCleanup(String storageKey) {
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override public void afterCompletion(int status) {
        if (status != TransactionSynchronization.STATUS_COMMITTED) storage.delete(storageKey);
      }
    });
  }
}
