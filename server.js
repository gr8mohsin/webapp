//Initialization
const express = require("express");
const app = express();
const {
   pool
} = require("./dbConfig");
const bcrypt = require("bcrypt");
const flash = require("express-flash");
const session = require("express-session");
const passport = require("passport");
const async = require("async");
const parse = require("postgres-date");
const moment = require("moment");

const initializePassport = require("./passportConfig");
const {
   request
} = require("http");
initializePassport(passport);

const PORT = process.env.PORT || 4000;
require("dotenv").config();
let organisation = [];

//Middleware
app.use(session({
   secret: "secret",

   resave: false,

   saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
   res.locals.moment = moment;
   next();
});


//Setting engine 

app.use(express.urlencoded({
   extended: true
})); //send details from frontend
app.set("view engine", "ejs");

app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'))
app.use('/js', express.static(__dirname + 'public/js'))
app.use('/img', express.static(__dirname + 'public/img'))


app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
});

//Main page
app.get("/", (req, res) => {
   res.render("index");
})

app.get("/users/logout", (req, res) => {
   req.logout(req.user, err => {
      if (err) return next(err);
      req.flash("success_msg", "You have logged out");
      res.redirect("/users/login");
   });
});

//Register 
app.get("/users/register", checkAuthenticated, (req, res) => {

   var sql_dept = "select department_name from ktsm_department";
   var sql_org = "select organisation_name from KTSM_ORGANISATIONS";
   pool.query(sql_dept, function (error, result, client) {
      var res_dept = result.rows;
      console.log(res_dept);
      pool.query(sql_org, function (error, result, client) {
         var res_org = result.rows;
         console.log(res_org);
         res.render("register.ejs", {
            dropdownVals: res_dept,
            dropdownOrg: res_org
         });
      });
   });
});

//Login
app.get("/users/login", checkAuthenticated, (req, res) => {
   res.render("login");
});

app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
   var username = req.user.name;

   var sql_assgn_users = "select name username from ktsm_users where user_department='IT'";
   var sql_impctd_srvcs = "select value1 impactedservice from KTSM_SYSCODE where organisationid=1001 and param1='IMPACTEDSERVICE'";
   var sql_incidentype = "select value1 incidenttype from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTTYPE'";
   var sql_incidentsvrty = "select value1 incidentseverity from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTSEVERITY'";
   var sql_incidentstatus = "select value1 incidentstatus from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTSTATUS'";

   pool.query(sql_assgn_users, function (error, result, client) {
      var res_assgn_users = result.rows;
      console.log(res_assgn_users);

      pool.query(sql_impctd_srvcs, function (error, result, client) {
         var res_impctd_srvcs = result.rows;
         console.log(res_impctd_srvcs);

         pool.query(sql_incidentype, function (error, result, client) {
            var res_incidentype = result.rows;
            console.log(res_incidentype);

            pool.query(sql_incidentsvrty, function (error, result, client) {
               var res_incidentsvrty = result.rows;
               console.log(res_incidentsvrty);

               pool.query(sql_incidentstatus, function (error, result, client) {
                  var res_incidentstatus = result.rows;
                  console.log(res_incidentstatus);

                  res.render("dashboard.ejs", {
                     ddAssgnUsersVals: res_assgn_users,
                     ddImpctdSrvcVals: res_impctd_srvcs,
                     ddIncidentType: res_incidentype,
                     ddIncidentSvrty: res_incidentsvrty,
                     ddIncidentStatus: res_incidentstatus,
                     user: req.user.name,
                     searchResult: 'GET test'
                  });
               });
            });
         });
      });
   });
});

//Incident
app.get("/", (req, res) => {

   res.render("incident");
});

//Register DB posting start

app.post("/users/register", async (req, res) => {

   let selectedItemDept = req.body.dept;

   let {
      name,
      email,
      password,
      password2,
      dob,
      mansup
   } = req.body;

   console.log('This is string', {
      name,
      email,
      password,
      password2,
      dob,
      mansup,
      selectedItemDept
   });

   console.log("Filling the all details.");

   let errors = [];

   if (!name || !email || !password || !password2 || !dob || !mansup) {
      console.log("Please fill all details.");
      errors.push({
         message: "Please fill all details."
      });
   }

   if (password.length < 6) {
      errors.push({
         message: "Password should be atleast 6 character long."
      });
   }

   if (password != password2) {
      errors.push({
         message: "Password do not match."
      });
   }

   if (errors.length > 0) {
      console.log("I am here 1");
   } else {
      //Form validation has passed
      let hashedPassword = await bcrypt.hash(password, 10);
      console.log(hashedPassword);
      pool.query(`SELECT * FROM ktsm_users WHERE email = $1`,
         [email],
         (err, results) => {
            if (err) {
               throw err;
            }

            console.log(results.rows);
            if (results.rows.length > 0) {
               console.log("Email is already registerd.");
               errors.push({
                  message: "Email is already registerd."
               });
            } else {
               pool.query(`INSERT INTO public.ktsm_users (name,email,password,dateofbirth,user_manager,user_department)
                            VALUES( $1, $2, $3, $4, $5, $6)
                            RETURNING id, password`, [name, email, hashedPassword, dob, mansup, selectedItemDept],
                  (err, results) => {
                     if (err) {
                        throw err;
                     }
                     console.log(results.rows);
                     req.flash("success_msg", "You are now registered, please login");
                     res.redirect("/users/login");
                  });
            }
         }
      );
   }

});

//Register DB posting end
app.post("/users/login",
   passport.authenticate('local', {
      successRedirect: "/users/dashboard",
      failureRedirect: "/users/login",
      failureFlash: true
   })
);

function checkAuthenticated(req, res, next) {
   if (req.isAuthenticated()) {
      return res.redirect("/users/dashboard");
   }
   next();
}

function checkNotAuthenticated(req, res, next) {
   if (req.isAuthenticated()) {
      return next();
   }
   res.redirect("/users/login");
}

/* Incident Posting start */
app.post('/incident', async (req, res) => {

   let selectedAssnTo = req.body.assignedto;
   let selectedImpctdsrvc = req.body.impactedservices;
   let selectedIncType = req.body.incidenttype;
   let selectedSvrty = req.body.severity;
   let selectedStatus = req.body.status;
   let incidentidValue = req.body.incidentidval;

   let {
      companyname,
      companynum,
      companyadd,
      incidentidval,
      reportdate,
      reportedby,
      clientdepartment,
      dateandtime,
      servicelevelagreement,
      incidentsummary,
      impact
   } = req.body;

   console.log('This is string', {
      companyname,
      companynum,
      companyadd,
      incidentidval,
      reportdate,
      reportedby,
      clientdepartment,
      dateandtime,
      servicelevelagreement,
      incidentsummary,
      impact,
      selectedAssnTo,
      selectedImpctdsrvc,
      selectedIncType,
      selectedSvrty,
      selectedStatus
   });

   console.log("Filling the all details.");

   let errors = [];

   if (!companyname || !companynum || !companyadd || !reportdate || !reportedby || !clientdepartment || !dateandtime || !servicelevelagreement || !incidentsummary || !impact) {
      console.log("Please fill all details.");
      errors.push({
         message: "Please fill all details."
      });
   }

   let buttonSaveVal = req.body.save;
   let buttonSaveNSubmitVal = req.body.submit;
   let buttonSearchVal = req.body.searchticket;
   let iticket_num = req.body.incidentidval;

   console.log('selectedStatus : ', selectedStatus);

   if (buttonSaveVal === 'SAVE') {
      let sql_query = "call public.p_iu_incident($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)";
      const results_out = await pool.query(sql_query,
         ['INCIDENT', companyname, companynum, companyadd, reportdate, reportedby, selectedAssnTo, clientdepartment, dateandtime, selectedIncType, selectedImpctdsrvc, servicelevelagreement, selectedSvrty, selectedStatus, incidentsummary, impact, 'SAVE', iticket_num],
         (err, results) => {

            if (err) {
               throw err.message;
            }

            let ticketno = results.rows;
            ticketno.forEach(ticket_number => {
               let {
                  iticket_number
               } = ticket_number;
               console.log(iticket_number);

               req.flash("success_msg", `${iticket_number}`);
               pool.query(`SELECT TICKET_NO,TICKET_TYPE,COMPANY_NAME,COMPANY_PHONE,COMPANY_ADDRESS,REPORTED_DATE,REPORTED_BY,ASSIGNED_TO,DEPARTMENT_NAME,INCIDENT_DATE,INCIDENT_TYPE,IMPACTED_SERVICES,SERVICELEVELAGREEMENT,SEVERITY,(CASE STATUS WHEN 0 THEN 'Open' WHEN 1 THEN 'In Progress' WHEN 2 THEN 'Closed' END) STATUS ,INCIDENT_SUMMARY,IMPACT,ATTACHEMENT_URL,TICKET_STATUS FROM KTSM_TICKETS WHERE ticket_no = $1`,
                  [iticket_number],
                  (err, result) => {
                     if (err) {
                        throw err;
                     }

                     res.render("dashboard.ejs", {
                        user: req.user.name,
                        searchResult: result.rows
                     });
                  })
            })
         });
   }

   if (buttonSearchVal === 'SEARCH') {
      console.log('Search Loading...');

      console.log(req.body.incidentidval);
      pool.query(`SELECT TICKET_NO,TICKET_TYPE,COMPANY_NAME,COMPANY_PHONE,COMPANY_ADDRESS,REPORTED_DATE,REPORTED_BY,ASSIGNED_TO,DEPARTMENT_NAME,INCIDENT_DATE,INCIDENT_TYPE,IMPACTED_SERVICES,SERVICELEVELAGREEMENT,SEVERITY,(CASE STATUS WHEN 0 THEN 'Open' WHEN 1 THEN 'In Progress' WHEN 2 THEN 'Closed' END) STATUS ,INCIDENT_SUMMARY,IMPACT,ATTACHEMENT_URL,TICKET_STATUS FROM KTSM_TICKETS WHERE ticket_no = $1`,
         [incidentidval],
         (err, result) => {
            if (err) {
               throw err;
            }

            console.log(result.rows);

            var sql_assgn_users = "select name username from ktsm_users where user_department='IT'";
            var sql_impctd_srvcs = "select value1 impactedservice from KTSM_SYSCODE where organisationid=1001 and param1='IMPACTEDSERVICE'";
            var sql_incidentype = "select value1 incidenttype from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTTYPE'";
            var sql_incidentsvrty = "select value1 incidentseverity from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTSEVERITY'";
            var sql_incidentstatus = "select value1 incidentstatus from KTSM_SYSCODE where organisationid=1001 and param1='INCIDENTSTATUS'";

            pool.query(sql_assgn_users, function (error, result, client) {
               var res_assgn_users = result.rows;
               console.log(res_assgn_users);

               pool.query(sql_impctd_srvcs, function (error, result, client) {
                  var res_impctd_srvcs = result.rows;
                  console.log(res_impctd_srvcs);

                  pool.query(sql_incidentype, function (error, result, client) {
                     var res_incidentype = result.rows;
                     console.log(res_incidentype);

                     pool.query(sql_incidentsvrty, function (error, result, client) {
                        var res_incidentsvrty = result.rows;
                        console.log(res_incidentsvrty);

                        pool.query(sql_incidentstatus, function (error, result, client) {
                           var res_incidentstatus = result.rows;
                           console.log(res_incidentstatus);

                           res.render('/incident', {
                              ddAssgnUsersVals: res_assgn_users,
                              ddImpctdSrvcVals: res_impctd_srvcs,
                              ddIncidentType: res_incidentype,
                              ddIncidentSvrty: res_incidentsvrty,
                              ddIncidentStatus: res_incidentstatus,
                              user: req.user.name,
                              searchResult: 'GET test'
                           });
                        });
                     });
                  });
               });
            });
         }
      )
   }
});
