package com.jonaslins.curso;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "modules")
public class Module {
  @Id public UUID id;
  @Column(name = "course_id", nullable = false) public UUID courseId;
  @Column(nullable = false) public int position;
  @Column(nullable = false, length = 160) public String title;
  public String description;
  @Column(name = "video_url") public String videoUrl;
  @Column(name = "video_storage_key") public String videoStorageKey;
  @Column(name = "video_original_name") public String videoOriginalName;
  @Column(name = "video_content_type") public String videoContentType;
  @Column(name = "video_size_bytes") public Long videoSizeBytes;
  @Column(name = "video_upload_status", nullable = false) public String videoUploadStatus = "NONE";
  @Column(nullable = false) public boolean published = false;
  @Column(name = "created_at", nullable = false) public Instant createdAt;
  @Column(name = "updated_at", nullable = false) public Instant updatedAt;

  @PrePersist
  void beforeCreate() {
    if (id == null) id = UUID.randomUUID();
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  @PreUpdate
  void beforeUpdate() { updatedAt = Instant.now(); }
}
