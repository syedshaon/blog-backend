const Author = require("../models/authorModel");
const Posts = require("../models/postModel");
const BlackJWT = require("../models/blackjwt");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");

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
          const user = await Author.findOne({ _id: decodedToken.id });
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
          const user = await Author.findOne({ _id: decodedToken.id });
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

const authorController = {
  // async test(req, res) {
  //   // return res.json(req.user);
  //   const user = req.user;

  //   const allPostsbyThisAuthor = await Posts.find({ author: user._id });
  //   if (allPostsbyThisAuthor.length > 0) {
  //     const newUser = {
  //       firstName: user.firstName,
  //       lastName: user.lastName,
  //       username: user.username,
  //     };
  //     return res.json({ allPostsbyThisAuthor, newUser });
  //   } else {
  //     return res.json({ message: "You have no posts yet!" });
  //   }
  // },
  // If loggedin then show list of blog posts of this user
  async index(req, res) {
    try {
      const user = req.user;
      if (user) {
        const allPostsbyThisAuthor = await Posts.find({ author: user._id }, "title timestamp  excerpt thumbnail author published");
        if (allPostsbyThisAuthor.length > 0) {
          const newUser = {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          };
          return res.json({ posts: allPostsbyThisAuthor });
        } else {
          return res.json({ message: "You have no posts yet!" });
        }
      }

      res.status(401).json({ message: "Unauthorized" });
    } catch (err) {
      let errorMessage = "Internal server error";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      res.status(401).json({ message: errorMessage });
    }
  },

  // Create a new author
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
      const existingAuthor = await Author.findOne({ username: email });
      if (existingAuthor) {
        throw new Error("Email is already in use");
      }

      // Save the user to the database
      // await newAuthor.save();

      bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
        // if err, do something
        if (err) {
          console.log(err);
        } else {
          // otherwise, store hashedPassword in DB
          const newAuthor = new Author({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.email,
            password: hashedPassword,
          });
          const author = await newAuthor.save();
          const message = "An author account with " + author.username + " email address created successfully!";
          // res.json(author);
          // Send a success response
          res.status(201).json({ message: message });
          // res.render("report", { title: "Author created successfully!" });
        }
      });
    } catch (err) {
      //return res.status(500).json({ message: "Internal server error" });
      // res.status(401).json({ message: err });

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
      const user = await Author.findOne({ username });

      // If the user is not found, return an error
      if (!user) {
        return res.status(404).json({ message: "Author not found" });
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
      //   httpsOnly: true,
      //   sameSite: "None",
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
        return res.status(404).json({ message: "Author not found", error: true });
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

        // res.clearCookie("token");
        res.clearCookie("refreshtoken");
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
  async author_update_get(req, res, next) {
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

  // Update an existing author
  async author_update(req, res, next) {
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
        const existingAuthor = await Author.findOne({
          _id: { $ne: currentUserID },
          username: targetUsername,
        });
        if (existingAuthor) {
          // throw new Error("Email is already in use");
          return res.status(422).send({ message: "Email is already in use" });
        }

        bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
          // if err, do something
          if (err) {
            console.log(err);
          } else {
            const updatedAuthor = {
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              username: req.body.email,
              password: hashedPassword,
            };
            const author = await Author.findByIdAndUpdate(user._id, updatedAuthor);

            const token = req.headers.authorization;

            // When user updates. blacklist his previous jwt.
            const newblacklistedJWT = new BlackJWT({
              token: token,
            });
            const result = await newblacklistedJWT.save();

            res.clearCookie("refreshtoken");

            return res.status(201).json({ message: "Author updated successfully" });
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
  async author_delete(req, res) {
    try {
      const user = req.user;
      if (user) {
        const allPostsbyThisAuthor = await Posts.find({ author: user._id }, "title text").exec();

        if (allPostsbyThisAuthor.length > 0) {
          res.status(401).json({ delete: false, message: "You first need to delete all your blog posts to delete your account." });
        } else {
          await Author.findByIdAndDelete(user._id);
          res.clearCookie("refreshtoken");
          return res.json({ delete: true, message: "Author deleted successfully!" });
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
  async post_create(req, res, next) {
    const user = req.user;
    if (user) {
      try {
        const { title, text, published, excerpt } = req.body;

        // Validate the user input
        if (!title || !text || !published || !excerpt) {
          throw new Error("Missing required fields");
        }

        // otherwise, store hashedPassword in DB
        const newPost = new Posts({
          title: title,
          text: text,
          author: user._id,
          published: published,
          excerpt: excerpt,
          thumbnail: req.file.path,
        });
        const post = await newPost.save();

        // Send a success response
        return res.status(201).json({ message: "Post Created Successfully!" });
      } catch (err) {
        let errorMessage = "Internal server error";

        if (err instanceof Error) {
          errorMessage = err.message;
        }

        res.status(401).json({ message: errorMessage });
      }
    }
  },
  async post_show(req, res, next) {
    try {
      const user = req.user;
      const id = req.params.id;

      const post = await Posts.findById(id);
      if (post) {
        if (JSON.stringify(post.author) === JSON.stringify(user._id)) {
          // return res.json({ post: post.author, author: user._id });
          return res.json({ title: post.title, timestamp: post.timestamp, text: post.text, published: post.published, excerpt: post.excerpt, thumbnail: post.thumbnail });
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
  async post_edit(req, res, next) {
    const user = req.user;
    const id = req.params.id;

    try {
      if (user) {
        const post = await Posts.findById(id);
        // const val = JSON.stringify(post.author) === JSON.stringify(user._id);
        // return res.json({ val });
        if (post) {
          if (JSON.stringify(post.author) === JSON.stringify(user._id)) {
            // return res.json({ post: post.author, author: user._id });
            try {
              const { title, text, published, excerpt } = req.body;

              // Validate the user input
              if (!title || !text || !published || !excerpt) {
                throw new Error("Missing required fields");
              }

              // console.log("ok");
              // otherwise, store hashedPassword in DB
              const updatedPost = req.file
                ? {
                    title: title,
                    text: text,
                    author: user._id,
                    excerpt: excerpt,
                    published: published,
                    thumbnail: req.file.path,
                  }
                : {
                    title: title,
                    text: text,
                    author: user._id,
                    excerpt: excerpt,
                    published: published,
                  };
              await Posts.findByIdAndUpdate(id, updatedPost);

              const uPost = await Posts.findById(id);

              // Send a success response
              return res.status(201).json({ post: uPost });
            } catch (err) {
              next(err);
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
  async post_delete(req, res, next) {
    const user = req.user;
    const id = req.params.id;
    try {
      const post = await Posts.findById(id);
      if (post) {
        if (JSON.stringify(post.author) === JSON.stringify(user._id)) {
          // return res.json({ post: post.author, author: user._id });
          try {
            await Posts.findByIdAndDelete(id);

            // Send a success response
            return res.json({ message: "Post deleted successfully!" });
          } catch (err) {
            let errorMessage = "Internal server error";

            if (err instanceof Error) {
              errorMessage = err.message;
            }

            res.status(401).json({ message: errorMessage });
          }
        }
      } else {
        res.status(401).json({ message: "Post not found!" });
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

module.exports = { authorController, isAuthenticated };
