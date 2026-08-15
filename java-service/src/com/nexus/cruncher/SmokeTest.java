package com.nexus.cruncher;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Lightweight smoke tests for CruncherServer, written against the JDK's
 * built-in HttpClient rather than JUnit — this environment has no Maven
 * Central access, so pulling in a test framework isn't an option. Run
 * against a live instance of the server (see java-service/README section
 * on running tests).
 *
 * Usage: java -cp out com.nexus.cruncher.SmokeTest [baseUrl]
 */
public class SmokeTest {

    static int passed = 0;
    static int failed = 0;

    public static void main(String[] args) throws Exception {
        String base = args.length > 0 ? args[0] : "http://localhost:8081";
        HttpClient client = HttpClient.newHttpClient();

        check("health check returns ok", () -> {
            String body = get(client, base + "/health");
            return body.contains("\"status\":\"ok\"");
        });

        check("primes up to 30 returns exactly 10 primes", () -> {
            String body = get(client, base + "/primes?limit=30");
            return body.contains("\"count\":10") && body.contains("[2,3,5,7,11,13,17,19,23,29]");
        });

        check("primes with limit 1 returns empty list", () -> {
            String body = get(client, base + "/primes?limit=1");
            return body.contains("\"count\":0");
        });

        check("collatz from 1 takes 0 steps", () -> {
            String body = get(client, base + "/collatz?start=1");
            return body.contains("\"steps\":0");
        });

        check("collatz from 27 reaches 1 eventually", () -> {
            String body = get(client, base + "/collatz?start=27");
            return body.trim().endsWith(",1]}");
        });

        check("palindrome detection: 'racecar' is a palindrome", () -> {
            String body = get(client, base + "/textanalysis?text=racecar");
            return body.contains("\"isPalindrome\":true");
        });

        check("palindrome detection: 'hello' is not a palindrome", () -> {
            String body = get(client, base + "/textanalysis?text=hello");
            return body.contains("\"isPalindrome\":false");
        });

        check("textanalysis counts words correctly", () -> {
            String body = get(client, base + "/textanalysis?text=one%20two%20three");
            return body.contains("\"wordCount\":3");
        });

        System.out.println();
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    private static String get(HttpClient client, String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        return res.body();
    }

    interface Check {
        boolean run() throws Exception;
    }

    private static void check(String name, Check c) {
        try {
            if (c.run()) {
                System.out.println("  ok  - " + name);
                passed++;
            } else {
                System.out.println("  FAIL - " + name);
                failed++;
            }
        } catch (Exception e) {
            System.out.println("  ERROR - " + name + " (" + e.getMessage() + ")");
            failed++;
        }
    }
}
