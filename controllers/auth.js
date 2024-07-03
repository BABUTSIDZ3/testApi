import express from "express";
import { queryDatabase } from "../utils/functions.js";
import { saltrounds } from "../utils/config.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const authRouter = express.Router();

const generateReferralCode = () => {
  const digits = "0123456789";
  let referralCode = "5"; // Start with 5 as per your requirement
  for (let i = 0; i < 9; i++) {
    referralCode += digits[Math.floor(Math.random() * digits.length)];
  }
  return referralCode;
};

const isReferralCodeUnique = async (code) => {
  const existingCode = await queryDatabase(
    `SELECT id FROM users WHERE referralCode = ?`,
    [code]
  );
  return existingCode.length === 0;
};

authRouter.post("/register", async (req, res) => {
  try {
    let { username, password, email, avatar, referralCode } = req.body;

    // Set default avatar based on avatar value
    avatar =
      avatar == 1
        ? "https://photos.google.com/u/2/photo/AF1QipOGYCB4npjaJLPuJQqAqEJKsKH7KyrCxyBDeubS"
        : "https://photos.google.com/u/2/photo/AF1QipO8idVh2ok3RbK-Q01vhOF3q7MN3zmiU7DX-stB";

    // Hash password using bcrypt
    const passwordHash = await bcrypt.hash(password, Number(saltrounds));

    // Check if username is already taken
    const existingUserName = await queryDatabase(
      `SELECT id FROM users WHERE username = ?`,
      [username]
    );
    if (existingUserName.length) {
      return res.status(400).json("Username already taken");
    }

    // Check if email is already taken
    const existingUserEmail = await queryDatabase(
      `SELECT id FROM users WHERE email = ?`,
      [email]
    );
    if (existingUserEmail.length) {
      return res.status(400).json("Email already taken");
    }

    // Generate a unique 10-digit referral code
    let uniqueReferralCode = generateReferralCode();
    while (!(await isReferralCodeUnique(uniqueReferralCode))) {
      uniqueReferralCode = generateReferralCode();
    }

    // Initialize referrer as null
    let referrer = null;

    // Check if there's a referrer and update their balance if referralCode matches
    if (referralCode) {
      const findReferrerQuery = `SELECT id FROM users WHERE referralCode = ?`;
      const referrerResult = await queryDatabase(findReferrerQuery, [
        referralCode,
      ]);
      if (referrerResult.length > 0) {
        referrer = referrerResult[0].id;
        await queryDatabase(
          `UPDATE users SET balance = balance + 1 WHERE id = ?`,
          [referrer]
        );
      } else {
        return res.status(400).json("Invalid referral code");
      }
    }

    // Insert new user into the database
    const sql_query = `INSERT INTO users (username, password, email, avatar, referralCode, referrer)
          VALUES (?, ?, ?, ?, ?, ?)`;
    const results = await queryDatabase(sql_query, [
      username,
      passwordHash,
      email,
      avatar,
      uniqueReferralCode,
      referrer,
    ]);

    // Return successful response
    res.status(201).json({
      result: {
        id: parseInt(results.insertId),
        username,
        email,
        avatar,
        referralCode: uniqueReferralCode,
      },
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json(error.message);
  }
});


// Verify After Registration
authRouter.post("/register/verify", async (req, res) => {
  try {
    const { email } = req.body;
    const findUserQuery = `SELECT id FROM users WHERE email = ?`;
    const result = await queryDatabase(findUserQuery, [email]);

    if (result.length) {
      const randomVerificationNumber =
        Math.floor(100000 + Math.random() * 900000) + result[0].id.toString();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "goldenstrategy777@gmail.com",
          pass: "ztoe uasj dgby ekay",
        },
      });
      const mailOptions = {
        from: "goldenstrategy777@gmail.com",
        to: email,
        subject: "verify your email",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #0056b3;">Email Verification</h2>
            <p>Hello,</p>
            <p>Please use the verification number below to verify your email address:</p>
            <div style="padding: 10px; background-color: #f2f2f2; text-align: center; border-radius: 5px; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold;">${randomVerificationNumber}</span>
            </div>
            <p>If you did not request this, please ignore this email.</p>
            <p>Thank you,</p>
            <p>The Golden Strategy Team</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">This email was sent to ${email}. If you did not request this, please contact our support.</p>
          </div>
        `,
      };
      const updateQuery = `UPDATE users SET verificationnumber = ? WHERE email = ?`;
      const timeoutQuery = `UPDATE users SET verificationnumber = NULL WHERE email = ?`;
      await queryDatabase(updateQuery, [randomVerificationNumber, email]);

      try {
        await transporter.sendMail(mailOptions);
        res.send("email sent successfully");
      } catch (error) {
        res.status(500).send("Email not sent");
      }

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

// Verify with Code
authRouter.put("/register/verify", async (req, res) => {
  try {
    const { verificationnumber } = req.body;
    const findUserQuery = `SELECT id FROM users WHERE verificationnumber = ?`;
    const result = await queryDatabase(findUserQuery, [verificationnumber]);

    if (result.length) {
      const updateQuery = `UPDATE users SET verifyed = "true", verificationnumber = NULL WHERE id = ?`;
      await queryDatabase(updateQuery, [result[0].id]);
      res.send("verified_success");
    } else {
      res.status(404).send("Incorrect verification code");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const findUserQuery = `
      SELECT id, token, verifyed, username, password, payment_status, email FROM users
      WHERE username = ? OR email = ?`;
    const result = await queryDatabase(findUserQuery, [
      usernameOrEmail,
      usernameOrEmail,
    ]);

    if (result.length) {
      const user = result[0];
      if (!user.verifyed) {
        return res.json({
          status: "you are not verified",
          token: user.token,
          email: user.email,
        });
      }

      if (user.payment_status !== 1) {
        return res.json({
          status: "payment status is not valid",
          token: user.token,
        });
      }

      const passwordCorrect = await bcrypt.compare(password, user.password);
      if (passwordCorrect) {
        const token = jwt.sign({ username: user.username }, saltrounds, {
          expiresIn: "1h",
        });
        const updateTokenQuery = `UPDATE users SET token = ? WHERE id = ?`;
        await queryDatabase(updateTokenQuery, [token, user.id]);
        res.json({ token });
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
          user: "goldenstrategy777@gmail.com",
          pass: "ztoe uasj dgby ekay",
        },
      });
      const mailOptions = {
        from: "goldenstrategy777@gmail.com",
        to: email,
        subject: "goldenstrategy777@gmail.com",
        html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #0056b3;">Password Reset Verification</h2>
                        <p>Hello,</p>
                        <p>We received a request to reset your password. Please use the verification number below to proceed:</p>
                        <div style="padding: 10px; background-color: #f2f2f2; text-align: center; border-radius: 5px; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold;">${randomVerificationNumber}</span>
                        </div>
                        <p>If you did not request a password reset, please ignore this email.</p>
                        <p>Thank you,</p>
                        <p>The Golden Strategy Team</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999;">This email was sent to ${email}. If you did not request this, please contact our support.</p>
                    </div>
                `,
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
