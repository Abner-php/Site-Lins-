package com.jonaslins.curso;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin")
class ModuleController {
  private final ModuleService service;

  ModuleController(ModuleService service) { this.service = service; }

  @GetMapping("/courses/{courseId}/modules")
  List<Module> list(@PathVariable UUID courseId) { return service.list(courseId); }

  @PostMapping("/courses/{courseId}/modules")
  @ResponseStatus(HttpStatus.CREATED)
  Module create(@PathVariable UUID courseId, @RequestBody ModuleTextRequest request) {
    return service.create(courseId, request.title(), request.description());
  }

  @PatchMapping("/modules/{id}")
  Module update(@PathVariable UUID id, @RequestBody ModuleTextRequest request) {
    return service.update(id, request.title(), request.description());
  }

  @PatchMapping("/modules/{id}/publish")
  Module publish(@PathVariable UUID id, @RequestBody PublishRequest request) {
    return service.publish(id, request.published());
  }

  @PutMapping("/courses/{courseId}/modules/order")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void reorder(@PathVariable UUID courseId, @RequestBody ReorderRequest request) {
    service.reorder(courseId, request.moduleIds());
  }

  @PostMapping(value = "/modules/{id}/video", consumes = "multipart/form-data")
  Module uploadVideo(@PathVariable UUID id, @RequestPart("video") MultipartFile video) {
    return service.uploadVideo(id, video);
  }

  @DeleteMapping("/modules/{id}/video")
  Module deleteVideo(@PathVariable UUID id) { return service.deleteVideo(id); }

  @DeleteMapping("/modules/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID id) { service.delete(id); }

  record ModuleTextRequest(String title, String description) {}
  record PublishRequest(boolean published) {}
  record ReorderRequest(List<UUID> moduleIds) {}
}
