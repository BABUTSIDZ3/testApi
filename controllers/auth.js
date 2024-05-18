import express from "express";
import { queryDatabase } from "../utils/functions.js";
import { saltrounds } from "../utils/config.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const authRouter = express.Router();

////////////USER REGISTRATION/////////////////
authRouter.post("/register", async (req, res) => {
  try {
    // Destructure request body
    const { username, password, email, avatar } = req.body;
    if (avatar == 1) {
      avatar =
        "https://photos.google.com/u/2/photo/AF1QipOGYCB4npjaJLPuJQqAqEJKsKH7KyrCxyBDeubS";
    } else {
      avatar =
        "https://photos.google.com/u/2/photo/AF1QipO8idVh2ok3RbK-Q01vhOF3q7MN3zmiU7DX-stB";
    }
    // Hash password
    const passwordHash = await bcrypt.hash(password, Number(saltrounds));
    // Check if username exists
    const existingUserName = await queryDatabase(
      `SELECT id FROM users WHERE username = ?`,
      [username]
    );
    if (existingUserName.length) {
      return res.status(400).json("Username already taken");
    }

    // Check if email exists
    const existingUserEmail = await queryDatabase(
      `SELECT id FROM users WHERE email = ?`,
      [email]
    );
    if (existingUserEmail.length) {
      return res.status(400).json("Email already taken");
    }

    // Insert new user
    const sql_query = `INSERT INTO users (username, password, email, avatar)
          VALUES (?, ?, ?, ?)`;
    const results = await queryDatabase(sql_query, [
      username,
      passwordHash,
      email,
      avatar,
    ]);
    res.status(201).json({
      result: {
        id: parseInt(results.insertId),
        ...req.body,
      },
      message: "მომხმარებელი დამატებულია",
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json("Internal Server Error");
  }
});

////////////VERIFY AFTER REGISTRATION//////////////////////
authRouter.post("/register/verify", async (req, res) => {
  try {
    // Destructure request body
    const { email } = req.body;
    // Create nodemailer transporter

    // Find user in the database
    const findUserQuery = `SELECT id FROM users WHERE email = ?`;
    const result = await queryDatabase(findUserQuery, [email]);

    if (result[0]) {
      // Generate a random verification number
      const randomVerificationNumber =
        Math.floor(100000 + Math.random() * 900000) + result[0].id.toString();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "babutsidze2003gia@gmail.com",
          pass: "fdbj faiu pdff zkxv",
        },
      });
      const mailOptions = {
        from: "babutsidze2003gia@gmail.com",
        to: email,
        subject: "verify your email",
        text: `Your verification number is: ${randomVerificationNumber}`,
      };
      // Update the verification number in the database
      const updateQuery = `UPDATE users SET verificationnumber = ? WHERE email = ?`;
      const timeoutQuery = `UPDATE users SET verificationnumber = NULL WHERE email = ?`;
      await queryDatabase(updateQuery, [randomVerificationNumber, email]);
      try {
        // Send email with the verification number

        await transporter.sendMail(mailOptions);
        res.send("email sent successfully");
      } catch (error) {
        res.send("Email not sent");
      }

      // Set a timeout to clear the verification number after 2 minutes
      setTimeout(async () => {
        await queryDatabase(timeoutQuery, [email]);
      }, 120000);
    } else {
      res.status(404).send("Email not found");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

authRouter.put("/register/verify", async (req, res) => {
  try {
    // Destructure request body
    const { verificationnumber } = req.body;

    // Check if the verification number exists in the database
    const findUserQuery = `SELECT id FROM users WHERE verificationnumber = ?`;
    const result = await queryDatabase(findUserQuery, [verificationnumber]);

    if (result[0]) {
      // Update the user to set verified=true and clear the verification number
      const updateQuery = `UPDATE users SET verifyed = ?, verificationnumber = ? WHERE verificationnumber = ?`;
      await queryDatabase(updateQuery, ["true", null, verificationnumber]);

      res.send("verifyed_success");
    } else {
      res.status(404).send("Incorrect verification code");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

////////////USER LOGIN/////////////////
authRouter.post("/login", async (req, res) => {
  try {
    // Destructure request body
    const { usernameOrEmail, password } = req.body;

    // Find user in the database by username or email
    const findUserQuery = `
      SELECT token,username,password FROM users 
      WHERE username = ? OR email = ?`;
    const result = await queryDatabase(findUserQuery, [
      usernameOrEmail,
      usernameOrEmail,
    ]);

    if (result.length) {
      // Check if password is correct
      const passwordCorrect = await bcrypt.compare(
        password,
        result[0]?.password
      );

      if (passwordCorrect) {
        // Generate JWT token
        const token = jwt.sign({ username: result[0].username }, saltrounds);

        // Update user token in the database
        const updateTokenQuery = `UPDATE users SET token = ? WHERE username = ?`;
        await queryDatabase(updateTokenQuery, [token, result[0].username]);

        res.json(token);
      } else {
        res.status(401).send("Username/email or password is incorrect");
      }
    } else {
      res.status(401).send("Username/email or password is incorrect");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

////////////FORGOT PASSWORD/////////////////
authRouter.post("/forgotpassword", async (req, res) => {
  try {
    // Destructure request body
    const { email } = req.body;

    // Check if email exists in the database
    const findUserQuery = `SELECT id FROM users WHERE email = ?`;
    const result = await queryDatabase(findUserQuery, [email]);

    if (result[0]) {
      // Generate a random verification number
      const randomVerificationNumber =
        Math.floor(100000 + Math.random() * 900000) + result[0].id.toString();

      // Update the verification number in the database
      const updateQuery = `UPDATE users SET passverificationnumber = ? WHERE email = ?`;
      await queryDatabase(updateQuery, [randomVerificationNumber, email]);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "babutsidze2003gia@gmail.com",
          pass: "fdbj faiu pdff zkxv",
        },
      });
      const mailOptions = {
        from: "babutsidze2003gia@gmail.com",
        to: email,
        subject: "verify your email",
        text: `Your verification number is: ${randomVerificationNumber}`,
      };

      await transporter.sendMail(mailOptions);

      res.send("email sent successfully");
    } else {
      res.status(404).send("Email not found");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

authRouter.put("/forgotpassword", async (req, res) => {
  try {
    // Destructure request body
    const { verificationCode, newPassword } = req.body;
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, Number(saltrounds));

    // Check if the verification code exists in the database
    const findUserQuery = `SELECT id FROM users WHERE passverificationnumber = ?`;
    const result = await queryDatabase(findUserQuery, [verificationCode]);

    if (result[0]) {
      // Update the password and clear the verification code in the database
      const updateQuery = `UPDATE users SET password = ?, passverificationnumber = NULL WHERE passverificationnumber = ?`;
      await queryDatabase(updateQuery, [passwordHash, verificationCode]);

      res.send("successfully updated");
    } else {
      res.status(404).send("Incorrect verification code");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});
export default authRouter;
