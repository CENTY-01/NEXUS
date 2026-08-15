FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY src ./src
RUN mkdir out && javac -d out src/com/nexus/cruncher/CruncherServer.java

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/out ./out
ENV PORT=8081
EXPOSE 8081
CMD ["java", "-cp", "out", "com.nexus.cruncher.CruncherServer"]
