import express from "express";
import { queryDatabase } from "../utils/functions.js";

const faqRouter = express.Router();

faqRouter.post("/", async (req, res) => {
  const { language } = req.body;
  let faqQuery = `SELECT question_en AS question, answer_en AS answer FROM faq`;
  if (language === "GE") {
    faqQuery = `SELECT question_ge AS question, answer_ge AS answer FROM faq`;
  }
  try {
    const result = await queryDatabase(faqQuery);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "An error occurred while fetching the FAQ" });
  }
});

export default faqRouter;
