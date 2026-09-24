package com.jonaslins.curso;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
class VideoStorageService {
  private static final Set<String> ALLOWED_TYPES = Set.of("video/mp4", "video/webm");
  private final Path root;
  private final long maxBytes;

  VideoStorageService(@Value("${app.storage.path:./data/uploads}") String path,
                      @Value("${app.storage.max-video-bytes:524288000}") long maxBytes) throws IOException {
    this.root = Paths.get(path).toAbsolutePath().normalize();
    this.maxBytes = maxBytes;
    Files.createDirectories(root.resolve("temp"));
    Files.createDirectories(root.resolve("videos"));
  }

  StoredVideo store(MultipartFile file) {
    validateMetadata(file);
    String extension = "video/mp4".equals(file.getContentType()) ? ".mp4" : ".webm";
    String key = "videos/" + UUID.randomUUID() + extension;
    Path temporary = root.resolve("temp/" + UUID.randomUUID() + ".part");
    Path destination = safePath(key);

    try {
      Files.copy(file.getInputStream(), temporary, StandardCopyOption.REPLACE_EXISTING);
      long actualSize = Files.size(temporary);
      if (actualSize <= 0 || actualSize > maxBytes) throw new IllegalArgumentException("O vídeo deve ter no máximo 500 MB.");
      validateSignature(temporary, file.getContentType());
      try {
        Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE);
      } catch (AtomicMoveNotSupportedException ignored) {
        Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
      }
      return new StoredVideo(key, cleanName(file.getOriginalFilename()), file.getContentType(), actualSize);
    } catch (IOException | RuntimeException error) {
      deletePath(temporary);
      deletePath(destination);
      throw error instanceof RuntimeException runtime ? runtime : new IllegalStateException("Não foi possível salvar o vídeo.", error);
    }
  }

  void delete(String key) {
    if (key == null || key.isBlank()) return;
    try { Files.deleteIfExists(safePath(key)); }
    catch (IOException error) { throw new IllegalStateException("Não foi possível remover o vídeo do armazenamento.", error); }
  }

  private void validateMetadata(MultipartFile file) {
    if (file == null || file.isEmpty()) throw new IllegalArgumentException("Escolha um vídeo.");
    if (!ALLOWED_TYPES.contains(file.getContentType())) throw new IllegalArgumentException("Use um vídeo MP4 ou WebM.");
    if (file.getSize() > maxBytes) throw new IllegalArgumentException("O vídeo deve ter no máximo 500 MB.");
  }

  private void validateSignature(Path file, String contentType) throws IOException {
    byte[] header = new byte[12];
    int bytesRead;
    try (InputStream input = Files.newInputStream(file)) { bytesRead = input.read(header); }
    if ("video/mp4".equals(contentType)) {
      if (bytesRead < 12 || header[4] != 'f' || header[5] != 't' || header[6] != 'y' || header[7] != 'p')
        throw new IllegalArgumentException("O conteúdo do arquivo não é um MP4 válido.");
    } else if (bytesRead < 4 || (header[0] & 0xff) != 0x1A || (header[1] & 0xff) != 0x45 || (header[2] & 0xff) != 0xDF || (header[3] & 0xff) != 0xA3) {
      throw new IllegalArgumentException("O conteúdo do arquivo não é um WebM válido.");
    }
  }

  private Path safePath(String key) {
    Path path = root.resolve(key).normalize();
    if (!path.startsWith(root)) throw new IllegalArgumentException("Caminho de vídeo inválido.");
    return path;
  }

  private String cleanName(String name) {
    if (name == null) return "video";
    return Paths.get(name).getFileName().toString().replaceAll("[\\r\\n]", "");
  }

  private void deletePath(Path path) {
    try { Files.deleteIfExists(path); } catch (IOException ignored) {}
  }

  record StoredVideo(String key, String originalName, String contentType, long sizeBytes) {}
}
