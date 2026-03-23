package com.example.concurrency;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.resilience.annotation.EnableResilientMethods;

@SpringBootApplication
@EnableResilientMethods  // @Retryable 활성화 — 낙관적 락 재시도용
public class ConcurrencyApplication {

	public static void main(String[] args) {
		SpringApplication.run(ConcurrencyApplication.class, args);
	}

}
