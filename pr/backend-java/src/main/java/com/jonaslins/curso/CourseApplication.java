package com.jonaslins.curso;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class CourseApplication {
  public static void main(String[] args) { SpringApplication.run(CourseApplication.class, args); }
}
