require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');


const app = express();

app.set('view engine', 'ejs');


app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

mongoDBurl = "mongodb+srv://admin-nadav:"+process.env.DB_PASS+"@cluster0.ohzh4.mongodb.net/becsDB";

mongoose.connect(mongoDBurl, {useNewUrlParser: true, useUnifiedTopology: true });

const bloodSchema = {
  type: String,
  name: String,
  quantity: Number,
  common: Number,
  donate: Array,
  receive: Array
};

const Type = mongoose.model("Type", bloodSchema);

//for database reset
// const a_plus = new Type({type: "A+",name:"Aplus" ,quantity: 50, common: 0.34, donate: ["A+","AB+"], receive: ["A+","A-","O+","O-"]});
// const b_plus = new Type({type: "B+",name:"Bplus", quantity: 50, common: 0.17, donate: ["B+","AB+"], receive: ["B+","B-","O+","O-"]});
// const ab_plus = new Type({type: "AB+",name:"ABplus", quantity: 50, common: 0.07, donate: ["AB+"], receive: ["A+","B+","AB+","O+","A-","B-","AB-","O-"]});
// const o_plus = new Type({type: "O+",name:"Oplus", quantity: 50, common: 0.32, donate: ["A+","B+","AB+","O+"], receive: ["O+","O-"]});
// const a_minus = new Type({type: "A-",name:"Aminus" ,quantity: 50, common: 0.04, donate: ["A+","A-","AB+","AB-"], receive: ["A-","O-"]});
// const b_minus = new Type({type: "B-",name:"Bminus", quantity: 50, common: 0.02, donate: ["B+","B-","AB+","AB-"], receive: ["B-","O-"]});
// const ab_minus = new Type({type: "AB-",name:"ABminus", quantity: 50, common: 0.01, donate: ["AB+","AB-"], receive: ["A-","B-","AB-","O-"]});
// const o_minus = new Type({type: "O-",name:"Ominus", quantity: 50, common: 0.03, donate: ["A+","B+","AB+","O+","A-","B-","AB-","O-"], receive: ["O-"]});
// const bloodTypes = [a_plus,b_plus,ab_plus,o_plus,a_minus,b_minus,ab_minus,o_minus];
// Type.insertMany(bloodTypes, function(err,docs){
// });

app.get("/", function(req,res){

  Type.find({}, function(err,foundItems){
    if(!err){
        res.render("recept_normal",{blood: foundItems});
    }
    else {
      console.log(err);
    }
  });
});

app.post("/addBlood",async function(req,res){
  const allBlood = await Type.find({}).exec();
  var newBloodUnits,oldAmount,bloodType;
  for(var i=0; i<allBlood.length; i++){
    newBloodUnits = parseInt(req.body[allBlood[i].name]);
    oldAmount = allBlood[i].quantity;
    bloodType = allBlood[i].type;
    await updateBlood(bloodType,oldAmount,newBloodUnits);
  }
  res.redirect("/");
});


app.post("/giveBlood",async function(req,res){
  //take the blood type object from database according to what user chose in the combobox
  const requestedBloodType = await Type.findOne({type: req.body.bloodSelected}).exec();
  //the amount that the user typed in the input
  var requestedAmount = parseInt(req.body.bloodAmount);

  receiveTypes = [];
  var typeObj;

  for(var i=0; i<requestedBloodType.receive.length; i++){
    typeObj = await Type.findOne({type: (requestedBloodType.receive)[i]}).lean().exec();
    typeObj["supply"] = 0;
    receiveTypes.push(typeObj);
  }

  sortByPriority(receiveTypes);
  var refresh =  5;
  var notEnoughUnits = "hidden";
  while(requestedAmount > 0){
    if(requestedAmount < refresh){
      refresh = requestedAmount;
    }

    amountToProvide = await bloodSupply(receiveTypes[0],refresh);
    if (amountToProvide == 0){
      notEnoughUnits = "visible";
      break;
    }
    requestedAmount -= amountToProvide;
    sortByPriority(receiveTypes);
  }
  for(var i=0; i<receiveTypes.length; i++){
    if(receiveTypes[i].supply > 0){
        await Type.updateOne({type: receiveTypes[i].type}, {quantity: receiveTypes[i].quantity - receiveTypes[i].supply}).exec();
    }
  }
  res.render("bloodList",{blood_list: receiveTypes, notEnoughFlag: notEnoughUnits});
});

app.post("/Emergency",async function(req,res){
  var unitsToSupply = parseInt(req.body.bloodAmount);
  var notEnoughUnits = "hidden";
  const oMinus = await Type.findOne({type: "O-"}).lean().exec();
  oMinus.supply = 0;
  if(oMinus.quantity < unitsToSupply){
    unitsToSupply = oMinus.quantity;
    notEnoughUnits = "visible";
  }
  oMinus.supply = unitsToSupply;
  await Type.updateOne({type:"O-"},{quantity: oMinus.quantity - unitsToSupply}).exec();
  res.render("bloodList",{blood_list: [oMinus], notEnoughFlag: notEnoughUnits})
});

async function updateBlood(bloodType,oldAmount,newBloodUnits){
  await Type.findOneAndUpdate({type: bloodType}, {quantity: oldAmount + newBloodUnits}).exec();
}

async function bloodSupply(type,amount){
  var amountTaken;
  if(type.quantity - type.supply < amount){
    amountTaken = type.quantity - type.supply;
  } else {
    amountTaken = amount;
  }
  type.supply += amountTaken;
  return amountTaken;
}

function sortByPriority(bloodTypesArray){
  bloodTypesArray.sort(function(type1,type2){
    return  priority(type2) - priority(type1);
  });
}

function priority(type){
  return ((type.quantity-type.supply)*type.common) / type.donate.length;
}

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});
