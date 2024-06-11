import express from "express";
import cors from "cors";
import { PORT } from "./utils/config.js";
import authRouter from "./controllers/auth.js";
import mariadb from "mariadb";
import usersRouter from "./controllers/users.js";
import questionsRouter from "./controllers/questions.js";
import resultsRouter from "./controllers/results.js";
import fromAdminRouter from "./controllers/fromAdmin.js";
import marketRouter from "./controllers/market.js";


export const conection = mariadb.createPool({
  host: "bqohr8a7iumyappvkudf-mysql.services.clever-cloud.com",
  user: "urc29xzncnewxm0t",
  password: "AnPehD1d6Jih1Tw7NzMn",
  database: "bqohr8a7iumyappvkudf",
  port: "3306",
  connectionLimit: 100, // Increased limit for handling higher concurrency
  connectTimeout: 100000
});

const app = express();
app.use(cors(),express.json())

app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/results", resultsRouter);
app.use("/api/admin", fromAdminRouter);
app.use("/api/market", marketRouter);

app.listen(3000, () => {
  console.log(`started on port ${PORT}`);
});
