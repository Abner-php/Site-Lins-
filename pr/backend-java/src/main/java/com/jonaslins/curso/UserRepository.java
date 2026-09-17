package com.jonaslins.curso;
import java.util.*; import org.springframework.data.jpa.repository.JpaRepository;
interface UserRepository extends JpaRepository<AppUser,UUID>{ Optional<AppUser> findByEmail(String email); }
