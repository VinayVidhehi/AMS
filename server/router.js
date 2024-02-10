const mongoose = require("mongoose");
const User = require("./models/user_schema");
const OTPModel = require("./models/otp_schema");
const nodemailer = require("nodemailer");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const connection = mysql.createConnection({
  host: "attendance-logger-spoorthivarumbudi-ddc7.a.aivencloud.com",
  port: 12226,
  user: "avnadmin",
  password: "AVNS_aRs9_9YVW7p-mEzvwzx",
  database: "defaultdb",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

(async () => {
  try {
    await mongoose
      .connect(
        "mongodb+srv://vinayvidhehi:TCWxRz3FVPro6DKM@ams.uaepwlv.mongodb.net/"
      )
      .then(() => console.log("connection successfull"));
  } catch (error) {
    console.error("Connection error:", error.message);
  }
})();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vinayvidhehi@gmail.com",
    pass: "avgo zstp olwh kppr ",
  },
});
//chrg qkgp cbmi jxgf
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: "vinayvidhehi@gmail.com",
    to: email,
    subject: "OTP verification for AMS",
    text: `Your one-time password for signing up for AMS is ${otp}. Please do not share this with anyone`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Unable to send OTP, try again later");
  }
};

const handleUserSignup = async (req, res) => {
  try {
    const { email, key } = req.body;

    if (!email) {
      throw new Error("Email is required");
    }

    if (key == 1) {
      // Handle OTP generation and email sending
      const generatedOTP = generateOTP();

      // Save OTP to MongoDB
      await OTPModel.create({ email, otp: generatedOTP });

      await sendOTPEmail(email, generatedOTP);

      res
        .status(200)
        .send({ message: "OTP sent to your email successfully", key: 1 });
    } else {
      if (key == 2) {
        const { email, name, counsellor, OTP, password, usn, batch } = req.body;

        // Handle user registration and OTP validation
        if (!OTP) {
          throw new Error("OTP is required");
        }

        // Find the OTP in MongoDB
        const foundOTP = await OTPModel.findOne({ email });

        if (!foundOTP || JSON.stringify(foundOTP.otp) !== OTP) {
          throw new Error("Entered OTP doesn't match. Try again later.");
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({ email, password: hashedPassword, isStaff: false, iscounsellor:false});
        // save all the incoming variables related to the user to students table in MySQL
        await newUser.save();

        var counsellorNumber;

        if (counsellor.startsWith("P")) {
          counsellorNumber = 1;
        } else if (counsellor.startsWith("Sa")) {
          counsellorNumber = 2;
        } else {
          counsellorNumber = 3;
        }

        const id = parseInt(usn.substring(usn.length - 3), 10);
        const query =
          "insert into students(id, name, usn, email, lab, counsellor) values (?, ?, ?, ?, ?, ?)";
        const values = [id, name, usn, email, batch, counsellorNumber];

        connection.query(query, values, (error, result) => {
          if (error) {
            console.log(error);
          } else {
            console.log(result);
          }
        });

        // Complete this to save users in students table;
        await OTPModel.findOneAndDelete({ email });
        res.status(200).send({ message: "User saved successfully", key: 1 });
      } else {
        const {name, password, OTP, courseIdId, batch, email} = req.body;

        if (!OTP) {
          throw new Error("OTP is required");
        }

        // Find the OTP in MongoDB
        const foundOTP = await OTPModel.findOne({ email });

        if (!foundOTP || JSON.stringify(foundOTP.otp) !== OTP) {
          res.send({message:"entered OTP doesnt match, try again", key:2})
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({
          email,
          password: hashedPassword,
          isStaff: true,
          iscounsellor: true,
        });
        // save all the incoming variables related to the user to students table in MySQL
        await newUser.save();
        //changing courseId string to id
        var courseId = 0;
        if(courseIdId.startsWith("DBS")) {
          courseId = 53;
        } else if(courseIdId.startsWith("AI")) {
          courseId = 52;
        }  
        const query =
          "insert into staff(name, email, courseId_id, counceller_id) values (?, ?, ?, ?)";
        const values = [name, email, courseId, batch];

        connection.query(query, values, (error, result) => {
          if (error) {
            console.log(error);
          } else {
            console.log(result);
          }
        });

        // Complete this to save users in students table;
        await OTPModel.findOneAndDelete({ email });
        res.status(200).send({ message: "User saved successfully", key: 1 });
      }
    }
  } catch (error) {
    console.error("Error during user signup:", error);
    res.status(500).send({ message: error.message, key: 0 });
  }
};

const attendanceUpdate = async (req, res) => {
  console.log("Ids of students who are present are ", req.query);

  // Save the attendance string to the database
  const attendanceString = req.query.id;
  const courseId = req.query.courseId;
  saveAttendanceToDB(attendanceString, courseId);

  res.json({ message: "Hello, this is your Express server with CORS!\n" });
};

// Function to save the attendance string to the database
// Function to save the attendance string to the database
function saveAttendanceToDB(attendanceString, courseId) {
  // Get the current date in 'YYYY-MM-DD' format
  const currentDate = new Date().toISOString().split("T")[0];

  // Get the current day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
  const currentDay = new Date().getDay();

  // Split the incoming comma-separated string into an array of IDs
  const incomingIDs = attendanceString.split(",").map(Number);

  // Create an array to store the attendance status (0 or 1) for each ID
  const status = Array(70).fill(0);

  // Loop through the incoming IDs and set the corresponding status to 1
  incomingIDs.forEach((id) => {
    // Check if the ID is within the valid range (0 to 69)
    if (id > 0 && id < 80) {
      status[id - 1] = 1;
    }
  });

  // Convert the status array to a string
  const statusString = status.join("");
  console.log("status string now is", statusString);

  // Assuming you have a table named courseId_attendance with columns 'date', 'day', 'courseId', and 'status'
  const query = "INSERT INTO courseId_attendance (date, day, ?, status) VALUES (?, ?, ?, ?)";

  connection.query(query, [courseId, currentDate, currentDay, statusString], (err, results) => {
    if (err) {
      console.error("Error saving attendance to database:", err.message);
    } else {
      console.log("Attendance saved to database.", results);
    }
  });
}

const getAttendance = async (req, res) => {
  const email = req.query.email;

    // Adjust the query to filter by courseId
  const query = `SELECT * FROM course_attendance;`;

  connection.query(query, async (err, results) => {
    if (err) {
      console.error("Error fetching attendance from database:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      console.log("Attendance fetched from database:", results);

      // Query the students table to get the id based on the provided email
      const studentsQuery = "SELECT id, name FROM students WHERE email = ?";

      connection.query(
        studentsQuery,
        [email],
        (studentsErr, studentsResults) => {
          if (studentsErr) {
            console.error(
              "Error fetching student ID from database:",
              studentsErr.message
            );
            res.status(500).json({ error: "Internal Server Error" });
          } else {
            console.log("Student ID fetched from database:", studentsResults);
            const studentID =
              studentsResults.length > 0 ? studentsResults[0].id : null;

              console.log("result is ", studentsResults)
            // Process attendance data to calculate attendance status and percentage
            const attendanceData = results.map((entry) => {
              const totalDays = Object.keys(entry).filter((key) =>
                key.startsWith("courseId")
              ).length;
              let presentDays = 0;
              
              console.log("entry is ", entry[2]);
              for (let i = 52; i <= 53; i++) {
                const statusChar = entry[`course${i}`][studentID - 1];
                const statusBool = statusChar === "1";

                if (statusBool) {
                  presentDays++;
                }
              }

              const attendancePercentage = (presentDays / totalDays) * 100;

              return {
                date: entry.date,
                status: attendancePercentage >= 75, // Assuming 75% as the threshold for 'Present'
                key: studentID > 43 ? 2 : 1,
                attendancePercentage: attendancePercentage.toFixed(2),
              };
            });

            console.log(attendanceData);
            // Prepare the final response object
            const responseWithStudentID = {
              attendance: attendanceData,
              studentID: studentID,
              name: studentsResults[0].name,
            };

            res.json(responseWithStudentID);
          }
        }
      );
    }
  });
};


const handleUserLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // User not found
      res.send({ key: 0, message: "User not found" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      // Passwords match, user found
     if (user.iscounsellor)  res.send({ key: 3, message: "User found" });
     else if (user.isStaff)  res.send({ key: 2, message: "User found" });
     else  res.send({ key: 1, message: "User found" });
    } else {
      // Passwords do not match
      res.send({ key: 0, message: "Incorrect password" });
    }
  } catch (error) {
    console.log("Error while searching for user:", error.message);
    res.status(500).send({ key: 0, message: "Internal Server Error" });
  }
};

const getStaffAttendance = async (req, res) => {
  const { email } = req.query;

  connection.query('SELECT course_id FROM staff WHERE email = ?', [email], (error, courseIdId) => {
    if (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      console.log("courseId found is ", courseIdId);
      const courseId = "course";
      const finalCourseId = courseId.concat(courseIdId[0].course_id);
      console.log(finalCourseId, typeof (finalCourseId));
      const query = `SELECT ${finalCourseId}, date FROM course_attendance;`;

      connection.query(query, async (err, results) => {
        if (err) {
          console.error("Error fetching attendance from database:", err.message);
          res.status(500).json({ error: "Internal Server Error" });
        } else {
          console.log("Attendance fetched from database:", results);

          // Query the students table to get the id and name of all students
          const studentsQuery = "SELECT id, name FROM students;";

          connection.query(studentsQuery, (studentsErr, studentsResults) => {
            if (studentsErr) {
              console.error("Error fetching student data from database:", studentsErr.message);
              res.status(500).json({ error: "Internal Server Error" });
            } else {
              console.log("Student data fetched from database:", studentsResults);
              res.status(200).json({key:1, attendance: results, students:studentsResults });
            }
          });
        }
      });
    }
  });
};


const getStatusText = (status) => {
  switch (status) {
    case "0":
      return "Absent";
    case "1":
      return "Present";
    case "2":
      return "Class Not Taken";
    default:
      return "Unknown Status";
  }
};


module.exports = {
  handleUserLogin,
  handleUserSignup,
  attendanceUpdate,
  getAttendance,
  getStaffAttendance,
};
/*
hashing passwords
attendance percentage column
make teachers to login with some code, so that they can see everybody's attendance
bring the whole attendance to frontend and add filter option 
*/
/*
change counceller attribute
update attendance for the ocr extracted dates
*/
