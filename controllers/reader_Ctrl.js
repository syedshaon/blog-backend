const Visitor = require("../models/visitorModel");
const Posts = require("../models/postModel");
const Comments = require("../models/commentModel");
const BlackJWT = require("../models/blackjwt");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// // Verify a JWT token
const verifyToken = async (token) => {
  const isBlacklisted = await BlackJWT.findOne({ token });
  if (isBlacklisted) {
    // console.log("Blacklisted JWT: " + isBlacklisted.token);
    // res.status(401).send("Invalid JWT");
    const user = false;
    return user;
  } else {
    const secret = process.env.JWT_SECRET;

    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, async (err, decodedToken) => {
        if (err) {
          // reject(err);
          const user = false;
          resolve(user);
        } else {
          const user = await Visitor.findOne({ _id: decodedToken.id });
          resolve(user);
        }
      });
    });
  }
};

// // Verify a Refresh token
const verifyRefreshToken = async (token) => {
  const isBlacklisted = await BlackJWT.findOne({ token });
  if (isBlacklisted) {
    // console.log("Blacklisted JWT: " + isBlacklisted.token);
    // res.status(401).send("Invalid JWT");
    const user = false;
    return user;
  } else {
    const secret = process.env.JWT_REFRESH;

    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, async (err, decodedToken) => {
        if (err) {
          // reject(err);
          const user = false;
          resolve(user);
        } else {
          const user = await Visitor.findOne({ _id: decodedToken.id });
          resolve(user);
        }
      });
    });
  }
};

const isAuthenticated = async (req, res, next) => {
  let authToken;
  if (req.headers.authorization) {
    authToken = req.headers.authorization;
  }
  // Validate the auth token.
  const user = await verifyToken(authToken);
  if (user) {
    // req.session.user = user;
    req.user = user;
    // res.locals.user = user;
    return next();
  }

  // The user is not authenticated.
  res.status(401).json({ message: "Unauthorized" });
};

async function generateToken(user) {
  const payload = {
    id: user._id,
    username: user.username,
  };

  const secret = process.env.JWT_SECRET;
  const options = {
    expiresIn: "15m",
  };

  return jwt.sign(payload, secret, options);
}

async function generateRefreshToken(user) {
  const payload = {
    id: user._id,
    username: user.username,
  };

  const secret = process.env.JWT_REFRESH;
  const options = {
    expiresIn: "10d",
  };

  return jwt.sign(payload, secret, options);
}

const readerController = {
  async index(req, res) {
    try {
      const allPosts = await Posts.find({ published: "published" }, "title timestamp  excerpt thumbnail  ")
        .populate({
          path: "author",
          model: "Author",
          select: "firstName lastName",
        }) // Populate the 'author' field with 'name' field from the Author model
        .exec();
      if (allPosts.length > 0) {
        return res.json({ posts: allPosts });
      } else {
        return res.json({ message: "No Published posts!" });
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async post_show(req, res, next) {
    try {
      const id = req.params.id;
      // return res.json({ id });

      const post = await Posts.findById(id)
        .populate({
          path: "author",
          model: "Author",
          select: "firstName lastName",
        }) // Populate the 'author' field with 'name' field from the Author model
        .exec();
      if (post) {
        if (post.published === "draft") {
          return res.json({ message: "Post you requested is in Draft mode!" });
        } else {
          return res.json({ post });
        }
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },

  // Create a new reader
  async signup(req, res, next) {
    try {
      const { firstName, lastName, email, password, rpassword } = req.body;

      // Validate the user input
      if (!firstName || !lastName || !email || !password || !rpassword) {
        throw new Error("Missing required fields");
      }

      const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

      if (!email.match(regex)) {
        throw new Error("Email address is invalid!");
      }

      // Validate the password

      if (password === email) {
        throw new Error("Can't use the email address as password.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      if (!/[A-Z]/.test(password)) {
        throw new Error("Password must contain at least one uppercase letter");
      }

      if (!/[a-z]/.test(password)) {
        throw new Error("Password must contain at least one lowercase letter");
      }

      if (!/[0-9]/.test(password)) {
        throw new Error("Password must contain at least one number");
      }

      // Ensure passwords match
      if (password !== rpassword) {
        throw new Error("Passwords do not match");
      }

      // Check if the user already exists
      const existingVisitor = await Visitor.findOne({ username: email });
      if (existingVisitor) {
        throw new Error("Email is already in use");
      }

      // Save the user to the database
      // await newVisitor.save();

      bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
        // if err, do something
        if (err) {
          console.log(err);
        } else {
          // otherwise, store hashedPassword in DB
          const newReader = new Visitor({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.email,
            password: hashedPassword,
          });
          const visitor = await newReader.save();
          const message = "A Reader account with " + visitor.username + " email address created successfully!";
          // res.json(visitor);
          // Send a success response
          res.status(201).json({ message: message });
          // res.render("report", { title: "Visitor created successfully!" });
        }
      });
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },

  // Authenticate author with jwt

  async signin(req, res) {
    try {
      // Get the user credentials from the request body
      const username = req.body.email;
      const password = req.body.password;

      // Find the user by their username
      const user = await Visitor.findOne({ username });

      // If the user is not found, return an error
      if (!user) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      // Verify the password
      const match = await bcrypt.compare(password, user.password);

      // If the password is incorrect, return an error
      if (!match) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      // Generate a JWT token for the user
      const token = await generateToken(user);
      const tokenExpires = new Date(Date.now() + 60 * 15 * 1000);
      const refreshtoken = await generateRefreshToken(user);

      // Set the JWT Refresh token in  browser cookie
      // res.cookie("refreshtoken", refreshtoken, {
      //   // expires: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour
      //   expires: new Date(Date.now() + 60 * 60 * 24 * 10 * 1000), // Expires in 10 days
      //   httpOnly: true,
      //   secure: true,
      // });

      // The above code is unable to set cookie on live site. I've tested different samesite attribute but result it same.

      // res.header("Set-Cookie", "refreshtoken=" + refreshtoken + ";Path=/;HttpOnly;Secure;SameSite=None;Expires=864000");

      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + 864000 * 1000); // Add milliseconds
      const expires = expirationDate.toUTCString();

      res.header("Set-Cookie", `refreshtoken=${refreshtoken}; Path=/; HttpOnly; Secure; SameSite=None; Expires=${expires}`);

      // Send the token to the user
      return res.json({ token, expire: tokenExpires, firstName: user.firstName });
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async refresh(req, res) {
    // Verify refresh token

    try {
      if (!req.cookies.refreshtoken) {
        return res.status(500).json({ message: "No Refresh Token Provided.", error: true });
      }

      const RefreshToken = req.cookies.refreshtoken;

      // Validate the auth token.
      const user = await verifyRefreshToken(RefreshToken);

      // If the user is not found, return an error
      if (!user) {
        return res.status(404).json({ message: "Visitor not found", error: true });
      }

      // Generate a JWT token for the user
      const token = await generateToken(user);
      const tokenExpires = new Date(Date.now() + 60 * 15 * 1000);
      // Send the token to the user
      return res.json({ token, expire: tokenExpires, firstName: user.firstName });
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async validateLoginStatus(req, res) {
    try {
      if (req.headers.authorization) {
        let authToken = req.headers.authorization;

        // Validate the auth token.
        const user = await verifyToken(authToken);
        if (user) {
          // req.session.user = user;

          return res.json({ firstName: user.firstName });
        }
      }
      return res.json({});
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async signout(req, res, next) {
    try {
      // Invalidate the user's JWT token.
      // const token = req.headers.authorization.split(" ")[1];
      if (req.headers.authorization) {
        const token = req.headers.authorization;

        const newblacklistedJWT = new BlackJWT({
          token: token,
        });
        const result = await newblacklistedJWT.save();

        res.clearCookie("refreshtoken");

        // res.clearCookie("token");
        return res.status(201).json({ logout: true, message: "Signed Out successfully!" });
      } else {
        return res.status(401).json({ logout: false, message: "You need to be logged in to logout." });
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async reader_update_get(req, res, next) {
    try {
      const user = req.user;
      return res.status(201).json({ firstName: user.firstName, lastName: user.lastName, email: user.username });
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },

  // Update an existing reader
  async reader_update(req, res, next) {
    // Validate the auth token.
    const user = req.user;
    if (user) {
      try {
        const { firstName, lastName, email, password, rpassword } = req.body;

        // Validate the user input
        if (!firstName || !lastName || !email || !password || !rpassword) {
          // throw new Error("Missing required fields");
          return res.status(422).send({ message: "Missing required fields" });
        }

        const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

        if (!email.match(regex)) {
          // throw new Error("Email address is invalid!");
          return res.status(422).send({ message: "Email address is invalid!" });
        }

        // Validate the password

        if (password === email) {
          // throw new Error("Can't use the email address as password.");
          return res.status(422).send({ message: "Can't use the email address as password." });
        }

        if (password.length < 8) {
          // throw new Error("Password must be at least 8 characters long");
          return res.status(422).send({ message: "Password must be at least 8 characters long" });
        }

        if (!/[A-Z]/.test(password)) {
          // throw new Error("Password must contain at least one uppercase letter");
          return res.status(422).send({ message: "Password must contain at least one uppercase letter" });
        }

        if (!/[a-z]/.test(password)) {
          // throw new Error("Password must contain at least one lowercase letter");
          return res.status(422).send({ message: "Password must contain at least one lowercase letter" });
        }

        if (!/[0-9]/.test(password)) {
          // throw new Error("Password must contain at least one number");
          return res.status(422).send({ message: "Password must contain at least one number" });
        }

        // Ensure passwords match
        if (password !== rpassword) {
          // throw new Error("Passwords do not match");
          return res.status(422).send({ message: "Passwords do not match" });
        }

        const currentUserID = user._id;
        const targetUsername = email;

        // Check if the user already exists
        const existingVisitor = await Visitor.findOne({
          _id: { $ne: currentUserID },
          username: targetUsername,
        });
        if (existingVisitor) {
          // throw new Error("Email is already in use");
          return res.status(422).send({ message: "Email is already in use" });
        }

        bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
          // if err, do something
          if (err) {
            console.log(err);
          } else {
            const updatedVisitor = {
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              username: req.body.email,
              password: hashedPassword,
            };
            const author = await Visitor.findByIdAndUpdate(user._id, updatedVisitor);

            const token = req.headers.authorization;

            // When user updates. blacklist his previous jwt.
            const newblacklistedJWT = new BlackJWT({
              token: token,
            });
            const result = await newblacklistedJWT.save();

            res.clearCookie("refreshtoken");

            return res.status(201).json({ message: "Visitor updated successfully" });
          }
        });
      } catch (err) {
        let errorMessage = "Internal server error";

        if (err instanceof Error) {
          errorMessage = err.message;
        }

        res.status(401).json({ message: errorMessage });
      }
    }
  },

  // Delete an existing author
  async reader_delete(req, res) {
    try {
      const user = req.user;
      if (user) {
        const allPostsbyThisVisitor = await Posts.find({ author: user._id }, "title text").exec();

        if (allPostsbyThisVisitor.length > 0) {
          res.status(401).json({ delete: false, message: "You first need to delete all your blog posts to delete your account." });
        } else {
          await Visitor.findByIdAndDelete(user._id);

          res.clearCookie("refreshtoken");

          return res.json({ delete: true, message: "Visitor deleted successfully!" });
        }
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async comments_create(req, res, next) {
    const user = req.user;
    if (user) {
      try {
        const { text, postId } = req.body;

        // Validate the user input
        if (!text || !postId) {
          throw new Error("Missing required fields");
        }

        // otherwise, store hashedPassword in DB
        const newComment = new Comments({
          text: text,
          visitor: user._id,
          post: postId,
        });
        const comment = await newComment.save();

        // Send a success response
        return res.status(201).json({ message: "Comment Created Successfully!" });
      } catch (err) {
        let errorMessage = "Internal server error";

        if (err instanceof Error) {
          errorMessage = err.message;
        }

        res.status(401).json({ message: errorMessage });
      }
    }
  },
  async comments_get(req, res) {
    const commentId = req.params.id;
    try {
      const allComments = await Comments.find({ _id: commentId })
        .populate({
          path: "visitor",
          model: "Visitor",
          select: "firstName lastName",
        }) // Populate the 'author' field with 'name' field from the Author model
        .exec();
      if (allComments.length > 0) {
        return res.json({ posts: allComments });
      } else {
        return res.json({ message: "No Published comments!" });
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },

  async comments_edit(req, res, next) {
    const user = req.user;
    const id = req.params.id;

    try {
      if (user) {
        const Comment = await Comments.findById(id);

        // const val = JSON.stringify(post.author) === JSON.stringify(user._id);
        // return res.json({ val });
        if (Comment) {
          if (JSON.stringify(Comment.visitor) === JSON.stringify(user._id)) {
            // return res.json({ post: post.author, author: user._id });
            // return res.json("came to this.");
            try {
              const { text, postId } = req.body;

              // Validate the user input
              if (!text || !postId) {
                throw new Error("Missing required fields");
              }

              // console.log("ok");
              // otherwise, store hashedPassword in DB
              const updatedComment = {
                text: text,
                visitor: user._id,
                post: postId,
              };
              await Comments.findByIdAndUpdate(id, updatedComment);

              const uComment = await Comments.findById(id);

              // Send a success response
              return res.status(201).json({ Comment: uComment });
            } catch (err) {
              let errorMessage = "Internal server error";

              if (err instanceof Error) {
                errorMessage = err.message;
              }

              res.status(401).json({ message: errorMessage });
            }
          }
        }
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
  async comments_delete(req, res, next) {
    const user = req.user;
    const id = req.params.id;
    try {
      const comment = await Comments.findById(id);
      if (comment) {
        if (JSON.stringify(comment.visitor) === JSON.stringify(user._id)) {
          // return res.json({ post: post.author, author: user._id });
          try {
            await Comments.findByIdAndDelete(id);

            // Send a success response
            return res.json({ message: "Comment deleted successfully!" });
          } catch (err) {
            let errorMessage = "Internal server error";

            if (err instanceof Error) {
              errorMessage = err.message;
            }

            res.status(401).json({ message: errorMessage });
          }
        }
      } else {
        res.status(401).json({ message: "Comment not found!" });
      }
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },
};

module.exports = { readerController, isAuthenticated };
