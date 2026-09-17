package com.jonaslins.curso;

import java.util.List;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

@Configuration class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder(){ return new BCryptPasswordEncoder(12); }
  @Bean UserDetailsService userDetailsService(UserRepository users){ return email -> users.findByEmail(email.toLowerCase()).orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("Usuário não encontrado")); }
  @Bean AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception { return c.getAuthenticationManager(); }
  @Bean CorsConfigurationSource cors(){ var c=new CorsConfiguration(); c.setAllowedOrigins(List.of("http://localhost:4173","https://SEU-DOMINIO.com")); c.setAllowedMethods(List.of("GET","POST","PATCH","DELETE")); c.setAllowedHeaders(List.of("Authorization","Content-Type")); var s=new UrlBasedCorsConfigurationSource(); s.registerCorsConfiguration("/**",c); return s; }
  @Bean SecurityFilterChain security(HttpSecurity http, JwtFilter jwt) throws Exception {
    return http.csrf(c->c.disable()).cors(c->{}).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .headers(h->h.contentSecurityPolicy(c->c.policyDirectives("default-src 'self'" )).frameOptions(f->f.deny()).referrerPolicy(r->r.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
      .authorizeHttpRequests(a->a.requestMatchers("/api/auth/**").permitAll().requestMatchers(HttpMethod.POST,"/api/bookings").permitAll().requestMatchers(HttpMethod.GET,"/api/courses/**").permitAll().requestMatchers("/api/admin/**").hasRole("TEACHER").anyRequest().authenticated())
      .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class).build();
  }
}
