const notesService = require('./notes.service');

async function list(req, res, next) {
  try {
    const notes = await notesService.listNotes(req.auth.storeId, req.query.search);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const note = await notesService.createNote(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const note = await notesService.updateNote(req.auth.storeId, req.params.id, req.body);
    res.json(note);
  } catch (err) {
    next(err);
  }
}

async function togglePin(req, res, next) {
  try {
    const result = await notesService.togglePin(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await notesService.deleteNote(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, togglePin, remove };
