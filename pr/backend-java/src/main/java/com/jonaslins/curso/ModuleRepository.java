package com.jonaslins.curso;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface ModuleRepository extends JpaRepository<Module, UUID> {
  List<Module> findByCourseIdOrderByPositionAsc(UUID courseId);

  @Query("select coalesce(max(m.position), 0) from Module m where m.courseId = :courseId")
  int findLastPosition(UUID courseId);
}
