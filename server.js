var auth = require(__dirname +'/auth');
var express = require('express');
var url=require('url');
var bodyParser  = require('body-parser');
var app = express();
var util = require('util');
var path = require('path');
var fs = require('fs');
var db = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;

db.connect("mongodb://localhost/", function(error, database) {
    if (error) return funcCallback(error);
    db=database.db("chauffage");

    console.log("Connecté à la base de données 'chauffage'");
});;

var morgan = require('morgan');
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs/access.log'), {flags: 'a'});
app.use(morgan('combined', {stream: accessLogStream}));


app.use(auth);

app.set('views', path.join(__dirname, '/views'));


var program=require(__dirname +'/program');
var program_sem=require(__dirname +'/program_sem');

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

var log_file = fs.createWriteStream(__dirname + '/logs/server.log', {flags : 'a'});
var log_stdout = process.stdout;

console.log = function(text) { //
    var d=new Date().toISOString().
	replace(/T/, ' ').      // replace T with a space
	replace(/\..+/, '')     // delete the dot and everything after

    log_file.write(d+"\t"+util.format(text) + '\n');
    log_stdout.write(d+"\t"+util.format(text) + '\n');
};

function sanitize(string) {
    return string.replace(/ /g, "_");
}

function ajouter_prog(req, res){
    var prog_name=sanitize(req.body.prog_name);
    var heure_debut=req.body.heure_debut;
    var heure_fin=req.body.heure_fin;
    var mode=req.body.mode;
    program.addProg(prog_name, heure_debut, heure_fin, mode);
    req.selected_prog = program.searchProgram(prog_name);
    return afficher_programs(req, res);
}


function supprime_prog(req, res) {
    var prog_name = sanitize(req.query.name);
    console.log("delete prog = "+prog_name);
    program.deleteProg(prog_name);

    return afficher_programs(req, res);
}

function edit_prog(req, res) {
    var prog_name = sanitize(req.query.name);
    req.selected_prog = program.searchProgram(prog_name);
    if(! req.selected_prog) {
	console.log("Cannot find program '"+prog_name+"'");
    }
    console.log("Edit Program name = "+req.selected_prog._name);
    return afficher_programs(req, res);
}

function afficher_programs(req, res) {
    var selected_prog=req.selected_prog;
    var progs=program.getPrograms();
    var nb_progs=progs.length;
    res.render('afficher_programs.ejs', {progs: progs, selected_prog:selected_prog, util:util});
 }


function ajouter_prog_sem(req, res){
    var prog_name=sanitize(req.body.prog_name);
    var prog = [req.body.lundi,
		req.body.mardi,
		req.body.mercredi,
		req.body.jeudi,
		req.body.vendredi,
		req.body.samedi,
		req.body.dimanche];
    program_sem.addProgSem(prog_name, prog);
    req.selected_prog = program_sem.searchProgramSem(prog_name);
    return afficher_program_sem(req, res);
}


function supprime_prog_sem(req, res) {

    var prog_name = sanitize(req.query.name);
    console.log("delete prog = "+prog_name);
    program_sem.deleteProgSem(prog_name);

    return afficher_program_sem(req, res);
}

function edit_prog_sem(req, res) {

    var prog_name = sanitize(req.query.name);
    req.selected_prog = program_sem.searchProgramSem(prog_name);
    if(req.selected_prog == null) {
	console.log("Cannot find program '"+prog_name+"'");
    } else {
	console.log("Edit Program name = "+req.selected_prog._name);
    }
    return afficher_program_sem(req, res);
}

function afficher_program_sem(req, res) {
    var selected_prog=req.selected_prog;
    var progs=program_sem.getProgramSem();
    var nb_progs=progs.length;

    var progs_jour=program.getPrograms();
    var nb_progs_jour=progs_jour.length;

    res.render('afficher_program_sem.ejs', {progs: progs, selected_prog:selected_prog, util:util, progs_jour:progs_jour, nb_progs_jour:nb_progs_jour});
}

function afficher_logs(req, res) {
    res.render('logs.ejs');
}

app.get('/', (req, res) => {
    var d=new Date().toISOString().
	replace(/T/, ' ').      // replace T with a space
	replace(/\..+/, '')     // delete the dot and everything after

    db.collection("zones").find().toArray((err, result) =>{
	if(err) console.log(err);
	res.render('index.ejs', {today:d, zones:result});
    });
});


app.post('/ajouter_zone', (req, res) => {

    if(req.body.id.length == 0) {
	// new zone
	db.collection("zones").save(req.body, (err, results) => {
	if (err) return console.log(err);
	console.log("add zone: "+req.body.name+ " - pin1="+req.body.pin1+ " - pin2="+req.body.pin2+" - program="+req.body.program);
	console.log('saved zone to database');
	res.redirect('/afficher_zones');
	});
    } else {
	// edit an existing zone

	db.collection("zones").update({"_id": ObjectId(req.body.id)}, req.body)
	    .then((success) => {
		console.log("edit zone: "+req.body.name+ " - pin1="+req.body.pin1+ " - pin2="+req.body.pin2+" - program="+req.body.program);
		console.log('saved zone to database');
		res.redirect('/afficher_zones');
	    })
	    .catch((error) => {
		console.log(error);
	    });
    }
});

app.get('/edit_zones', (req, res) => {

    db.collection("zones").findOne(
	{ "_id":  ObjectId(req.query.id) },
	(err, selected_zone) => {
	    if(err) throw err;
	    if(selected_zone == null) {
		console.log("cannot find "+req.query.id);
	    } else {
		if(err) throw err;
		db.collection("zones").find().toArray((err, result_zones) =>{
		    res.render('afficher_zones.ejs',
			       {zones: result_zones,
				selected_zone:selected_zone,
				selected_prog:"",
				programs:"",
				nb_programs:""});
		});
	    }
	});
});

app.get('/supprime_zone', (req, res) => {
    db.collection("zones").remove(
	{ "_id":  ObjectId(req.query.id) },
	(err, document) => {
	    if(err) throw err;
	    console.log("Zone supprimée: "+req.query.id);

	    res.redirect('/afficher_zones');
	});

});

app.get('/afficher_zones', (req, res) => {

    db.collection("zones").find().toArray((err, result_zones) =>{
	res.render('afficher_zones.ejs',
	       {zones: result_zones,
		selected_zone:"",
		selected_prog:"",
		programs:"",
		nb_programs:""});
    });
});


app.post('/ajouter_prog', ajouter_prog);
app.get('/supprime_prog', supprime_prog);
app.get('/edit_prog', edit_prog);
app.get('/afficher_programs', afficher_programs);

app.post('/ajouter_prog_sem', ajouter_prog_sem);
app.get('/supprime_prog_sem', supprime_prog_sem);
app.get('/edit_prog_sem', edit_prog_sem);
app.get('/program_semaine', afficher_program_sem);

app.get('/logs', afficher_logs);

app.use(function(req, res, next){
    var page = url.parse(req.url).pathname;
    res.setHeader('Content-Type', 'text/plain');
    res.status(404).send('Page introuvable: "'+page+'"');
});

console.log("");
console.log("---------------");
console.log("Server starting");

app.listen(8080);
