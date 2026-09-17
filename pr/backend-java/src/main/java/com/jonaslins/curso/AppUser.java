package com.jonaslins.curso;
import jakarta.persistence.*; import java.util.*; import org.springframework.security.core.*; import org.springframework.security.core.authority.SimpleGrantedAuthority; import org.springframework.security.core.userdetails.UserDetails;
@Entity @Table(name="users") public class AppUser implements UserDetails {
 @Id public UUID id=UUID.randomUUID(); public String name; @Column(unique=true) public String email; @Column(name="password_hash") public String passwordHash; public String role="STUDENT";
 protected AppUser(){} public AppUser(String name,String email,String hash,String role){this.name=name;this.email=email.toLowerCase();this.passwordHash=hash;this.role=role;}
 public Collection<? extends GrantedAuthority> getAuthorities(){return List.of(new SimpleGrantedAuthority("ROLE_"+role));} public String getPassword(){return passwordHash;} public String getUsername(){return email;} public boolean isAccountNonExpired(){return true;} public boolean isAccountNonLocked(){return true;} public boolean isCredentialsNonExpired(){return true;} public boolean isEnabled(){return true;}
}
