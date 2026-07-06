import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(
    helmet({
      // Real, restrictive CSP rather than helmet's permissive default — 'unsafe-inline'
      // on style/script is needed only because Swagger UI (the sole HTML page this API
      // serves, at /api/docs) injects inline styles/scripts; every other response here
      // is plain JSON with no script execution surface at all.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.enableCors({
    origin: config.get<string>("app.corsOrigin"),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MICA MAB Fleet & Maintenance API")
    .setDescription("Enterprise vehicle fleet & maintenance management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get<number>("app.port") ?? 4000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (docs at /api/docs)`);
}

bootstrap();
