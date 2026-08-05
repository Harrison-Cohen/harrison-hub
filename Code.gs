// ============================================================
// Harrison's Hub — Google Apps Script backend
//
// Bound to a Google Sheet (Extensions > Apps Script). Deploy as a
// Web App; doGet(e) routes on e.parameter.action and returns JSON.
//
// This file is the source of truth for the backend. When it's
// edited, copy/paste the updated contents into the Apps Script
// editor at script.google.com and push a new deployment version
// (Deploy > Manage deployments > pencil icon > Version: New
// version > Deploy).
//
// See SETUP STEPS at the bottom of this file.
// ============================================================

function doGet(e) {
  const action = (e.parameter.action || 'getAll');
  let result;
  try {
    if (action === 'getAll') {
      result = getAllData();
    } else if (action === 'addMovie') {
      result = { movies: addMovie(e.parameter.title, e.parameter.notes) };
    } else if (action === 'addWatchedMovie') {
      result = { movies: addWatchedMovie(e.parameter.title, e.parameter.rating, e.parameter.notes) };
    } else if (action === 'markWatched') {
      result = { movies: markWatched(e.parameter.id, e.parameter.rating, e.parameter.notes) };
    } else if (action === 'updateMovie') {
      result = { movies: updateMovie(e.parameter.id, e.parameter.title, e.parameter.notes, e.parameter.rating, e.parameter.status) };
    } else if (action === 'deleteMovie') {
      result = { movies: deleteMovie(e.parameter.id) };

    } else if (action === 'addQuote') {
      result = { quotes: addQuote(e.parameter.text, e.parameter.date, e.parameter.source) };
    } else if (action === 'updateQuote') {
      result = { quotes: updateQuote(e.parameter.id, e.parameter.text, e.parameter.date, e.parameter.source) };
    } else if (action === 'deleteQuote') {
      result = { quotes: deleteQuote(e.parameter.id) };

    } else if (action === 'addRecipe') {
      result = { recipes: addRecipe(e.parameter.name, e.parameter.notes, e.parameter.ingredientsJson, e.parameter.stepsJson, e.parameter.source) };
    } else if (action === 'updateRecipe') {
      result = { recipes: updateRecipe(e.parameter.id, e.parameter.name, e.parameter.notes, e.parameter.ingredientsJson, e.parameter.stepsJson, e.parameter.source) };
    } else if (action === 'deleteRecipe') {
      result = { recipes: deleteRecipe(e.parameter.id) };

    } else if (action === 'addTemplate') {
      result = { templates: addTemplate(e.parameter.templateName, e.parameter.fieldsJson) };
    } else if (action === 'updateTemplate') {
      result = { templates: updateTemplate(e.parameter.id, e.parameter.templateName, e.parameter.fieldsJson) };
    } else if (action === 'deleteTemplate') {
      result = { templates: deleteTemplate(e.parameter.id) };

    } else if (action === 'createTabFromTemplate') {
      result = { customTabs: createTabFromTemplate(e.parameter.templateId, e.parameter.tabName) };
    } else if (action === 'deleteCustomTab') {
      result = { customTabs: deleteCustomTab(e.parameter.tabId) };
    } else if (action === 'listCustomTabs') {
      result = { customTabs: getCustomTabsList() };
    } else if (action === 'getCustomTabData') {
      result = { entries: getCustomTabData(e.parameter.tabId) };
    } else if (action === 'addCustomTabEntry') {
      result = { entries: addCustomTabEntry(e.parameter.tabId, e.parameter.dataJson) };
    } else if (action === 'updateCustomTabEntry') {
      result = { entries: updateCustomTabEntry(e.parameter.tabId, e.parameter.id, e.parameter.dataJson) };
    } else if (action === 'deleteCustomTabEntry') {
      result = { entries: deleteCustomTabEntry(e.parameter.tabId, e.parameter.id) };

    } else {
      result = { error: 'unknown action: ' + action };
    }
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------- Sheet helpers ----------------

let _ssCache = null;
function ss() {
  if (!_ssCache) _ssCache = SpreadsheetApp.getActiveSpreadsheet();
  return _ssCache;
}

function ensureSheet(name, headers) {
  let sheet = ss().getSheetByName(name);
  if (!sheet) {
    sheet = ss().insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0]) continue; // skip rows with no id
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function findRowIndexById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) return r + 1; // 1-indexed sheet row
  }
  return -1;
}

function deleteRowById(sheet, id) {
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) sheet.deleteRow(rowIdx);
}

function newId() {
  return Utilities.getUuid();
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

// ---------------- getAll ----------------

function getAllData() {
  const customTabs = getCustomTabsList();
  const customTabsData = {};
  customTabs.forEach(function (t) {
    customTabsData[t.id] = getCustomTabDataForTab(t);
  });
  return {
    movies: getMovies(),
    quotes: getQuotes(),
    recipes: getRecipes(),
    templates: getTemplates(),
    customTabs: customTabs,
    customTabsData: customTabsData
  };
}

// ---------------- Movies ----------------

const MOVIES_HEADERS = ['id', 'title', 'status', 'rating', 'notes', 'dateAdded'];

function moviesSheet() {
  return ensureSheet('Movies', MOVIES_HEADERS);
}

function getMovies() {
  return sheetToObjects(moviesSheet());
}

function addMovie(title, notes) {
  title = (title || '').trim();
  if (!title) return getMovies();
  const sheet = moviesSheet();
  sheet.appendRow([newId(), title, 'towatch', '', notes || '', Date.now()]);
  return getMovies();
}

function addWatchedMovie(title, rating, notes) {
  title = (title || '').trim();
  if (!title) return getMovies();
  const sheet = moviesSheet();
  sheet.appendRow([newId(), title, 'watched', Number(rating) || 0, notes || '', Date.now()]);
  return getMovies();
}

function markWatched(id, rating, notes) {
  const sheet = moviesSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    sheet.getRange(rowIdx, 3).setValue('watched'); // status
    sheet.getRange(rowIdx, 4).setValue(Number(rating) || 0); // rating
    if (notes) sheet.getRange(rowIdx, 5).setValue(notes); // notes
  }
  return getMovies();
}

function updateMovie(id, title, notes, rating, status) {
  const sheet = moviesSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    if (title !== undefined && title !== null && title !== '') sheet.getRange(rowIdx, 2).setValue(title);
    if (status !== undefined && status !== null && status !== '') sheet.getRange(rowIdx, 3).setValue(status);
    if (rating !== undefined && rating !== null && rating !== '') sheet.getRange(rowIdx, 4).setValue(Number(rating));
    if (notes !== undefined && notes !== null) sheet.getRange(rowIdx, 5).setValue(notes);
  }
  return getMovies();
}

function deleteMovie(id) {
  deleteRowById(moviesSheet(), id);
  return getMovies();
}

// ---------------- Quotes ----------------

const QUOTES_HEADERS = ['id', 'text', 'date', 'source', 'dateAdded'];

function quotesSheet() {
  return ensureSheet('Quotes', QUOTES_HEADERS);
}

function getQuotes() {
  return sheetToObjects(quotesSheet());
}

function addQuote(text, date, source) {
  text = (text || '').trim();
  if (!text) return getQuotes();
  const sheet = quotesSheet();
  sheet.appendRow([newId(), text, date || '', source || '', Date.now()]);
  return getQuotes();
}

function updateQuote(id, text, date, source) {
  const sheet = quotesSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    if (text) sheet.getRange(rowIdx, 2).setValue(text);
    sheet.getRange(rowIdx, 3).setValue(date || '');
    sheet.getRange(rowIdx, 4).setValue(source || '');
  }
  return getQuotes();
}

function deleteQuote(id) {
  deleteRowById(quotesSheet(), id);
  return getQuotes();
}

// ---------------- Recipes ----------------

const RECIPES_HEADERS = ['id', 'name', 'notes', 'ingredients', 'steps', 'source', 'dateAdded'];

function recipesSheet() {
  return ensureSheet('Recipes', RECIPES_HEADERS);
}

function getRecipes() {
  const rows = sheetToObjects(recipesSheet());
  rows.forEach(function (r) {
    r.ingredients = safeJsonParse(r.ingredients, []);
    r.steps = safeJsonParse(r.steps, []);
  });
  return rows;
}

function addRecipe(name, notes, ingredientsJson, stepsJson, source) {
  name = (name || '').trim();
  if (!name) return getRecipes();
  const sheet = recipesSheet();
  sheet.appendRow([newId(), name, notes || '', ingredientsJson || '[]', stepsJson || '[]', source || '', Date.now()]);
  return getRecipes();
}

function updateRecipe(id, name, notes, ingredientsJson, stepsJson, source) {
  const sheet = recipesSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    if (name) sheet.getRange(rowIdx, 2).setValue(name);
    sheet.getRange(rowIdx, 3).setValue(notes || '');
    sheet.getRange(rowIdx, 4).setValue(ingredientsJson || '[]');
    sheet.getRange(rowIdx, 5).setValue(stepsJson || '[]');
    sheet.getRange(rowIdx, 6).setValue(source || '');
  }
  return getRecipes();
}

function deleteRecipe(id) {
  deleteRowById(recipesSheet(), id);
  return getRecipes();
}

// ---------------- Templates ----------------

const TEMPLATES_HEADERS = ['id', 'templateName', 'fieldsJson'];

function templatesSheet() {
  return ensureSheet('Templates', TEMPLATES_HEADERS);
}

function getTemplates() {
  const rows = sheetToObjects(templatesSheet());
  rows.forEach(function (r) {
    r.fields = safeJsonParse(r.fieldsJson, []);
  });
  return rows;
}

function addTemplate(templateName, fieldsJson) {
  templateName = (templateName || '').trim();
  if (!templateName) return getTemplates();
  const sheet = templatesSheet();
  sheet.appendRow([newId(), templateName, fieldsJson || '[]']);
  return getTemplates();
}

function updateTemplate(id, templateName, fieldsJson) {
  const sheet = templatesSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    if (templateName) sheet.getRange(rowIdx, 2).setValue(templateName);
    sheet.getRange(rowIdx, 3).setValue(fieldsJson || '[]');
  }
  return getTemplates();
}

function deleteTemplate(id) {
  deleteRowById(templatesSheet(), id);
  return getTemplates();
}

// ---------------- Custom tabs (spawned from templates) ----------------

const CUSTOM_TABS_HEADERS = ['id', 'tabName', 'templateId', 'sheetName', 'fieldsJson', 'order', 'dateAdded'];

function customTabsRegistrySheet() {
  return ensureSheet('CustomTabs', CUSTOM_TABS_HEADERS);
}

function getCustomTabsList() {
  const rows = sheetToObjects(customTabsRegistrySheet());
  rows.forEach(function (r) {
    r.fields = safeJsonParse(r.fieldsJson, []);
  });
  rows.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  return rows;
}

function sanitizeSheetName(name) {
  const cleaned = String(name).replace(/[\[\]\*\/\\\?:]/g, '').trim().slice(0, 60);
  return cleaned || 'Tab';
}

function uniqueSheetName(base) {
  let name = base;
  let n = 2;
  while (ss().getSheetByName(name)) {
    name = base + ' ' + n;
    n++;
  }
  return name;
}

function createTabFromTemplate(templateId, tabName) {
  tabName = (tabName || '').trim();
  if (!tabName) return getCustomTabsList();
  const templates = getTemplates();
  const template = templates.filter(function (t) { return t.id === templateId; })[0];
  if (!template) return getCustomTabsList();

  const fields = template.fields || [];
  const sheetName = uniqueSheetName(sanitizeSheetName(tabName));
  const headers = ['id', 'dateAdded'].concat(fields.map(function (f) { return f.label; }));
  ensureSheet(sheetName, headers);

  const registry = customTabsRegistrySheet();
  const existing = getCustomTabsList();
  const order = existing.length;
  const id = newId();
  registry.appendRow([id, tabName, templateId, sheetName, JSON.stringify(fields), order, Date.now()]);
  return getCustomTabsList();
}

function deleteCustomTab(tabId) {
  const registry = customTabsRegistrySheet();
  const rows = getCustomTabsList();
  const tab = rows.filter(function (t) { return t.id === tabId; })[0];
  if (tab) {
    const dataSheet = ss().getSheetByName(tab.sheetName);
    if (dataSheet) ss().deleteSheet(dataSheet);
    deleteRowById(registry, tabId);
  }
  return getCustomTabsList();
}

function getCustomTabInfo(tabId) {
  return getCustomTabsList().filter(function (t) { return t.id === tabId; })[0];
}

function getCustomTabData(tabId) {
  return getCustomTabDataForTab(getCustomTabInfo(tabId));
}

// Same as getCustomTabData, but takes an already-fetched tab object instead
// of a tabId, so callers that already have the tab (e.g. getAllData looping
// over the registry) don't re-read the whole CustomTabs sheet per tab.
function getCustomTabDataForTab(tab) {
  if (!tab) return [];
  const sheet = ss().getSheetByName(tab.sheetName);
  if (!sheet) return [];
  const fields = tab.fields || [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0]) continue;
    const obj = { id: row[0], dateAdded: row[1], data: {} };
    fields.forEach(function (f, i) {
      obj.data[f.label] = row[2 + i];
    });
    out.push(obj);
  }
  return out;
}

function addCustomTabEntry(tabId, dataJson) {
  const tab = getCustomTabInfo(tabId);
  if (!tab) return [];
  const sheet = ss().getSheetByName(tab.sheetName);
  const fields = tab.fields || [];
  const data = safeJsonParse(dataJson, {});
  const row = [newId(), Date.now()].concat(fields.map(function (f) {
    const v = data[f.label];
    return v === undefined || v === null ? '' : v;
  }));
  sheet.appendRow(row);
  return getCustomTabData(tabId);
}

function updateCustomTabEntry(tabId, id, dataJson) {
  const tab = getCustomTabInfo(tabId);
  if (!tab) return [];
  const sheet = ss().getSheetByName(tab.sheetName);
  const fields = tab.fields || [];
  const data = safeJsonParse(dataJson, {});
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx !== -1) {
    fields.forEach(function (f, i) {
      const v = data[f.label];
      sheet.getRange(rowIdx, 3 + i).setValue(v === undefined || v === null ? '' : v);
    });
  }
  return getCustomTabData(tabId);
}

function deleteCustomTabEntry(tabId, id) {
  const tab = getCustomTabInfo(tabId);
  if (!tab) return [];
  const sheet = ss().getSheetByName(tab.sheetName);
  deleteRowById(sheet, id);
  return getCustomTabData(tabId);
}

// ============================================================
// ONE-TIME SEED — run seedAll() once from the Apps Script editor
// (select it in the function dropdown, click Run) to populate
// Movies / Quotes / Recipes with starting data and create the two
// example Templates (Book, Wishlist). Safe to run once; re-running
// will append duplicates, so only run it on a fresh Sheet.
// ============================================================

function seedAll() {
  seedMovies();
  seedQuotes();
  seedRecipes();
  seedTemplates();
}

function seedMovies() {
  const toWatchTitles = [
    "The Pursuit of Happyness", "Rocky III", "Rocky IV", "Rocky V", "Creed", "Creed II", "Creed III",
    "Anchorman: The Legend of Ron Burgundy", "Inglourious Basterds", "Spy Game", "Blazing Saddles",
    "Hacksaw Ridge", "History of the World, Part I", "Monty Python's Life of Brian", "American History X",
    "The Hateful Eight", "Dirty Dancing", "La La Land", "Donnie Darko", "Wedding Crashers",
    "Snowfall (show)", "Fletch", "I'm Gonna Git U Sucka", "Dolemite", "Stand and Deliver", "The Notebook",
    "Once Upon a Time in Hollywood", "Pretty Woman", "This Is the End", "Scarface", "Driving Miss Daisy",
    "Rain Man", "Mad Men (show)", "Kindergarten Cop"
  ];

  const watched = [
    ["Pulp Fiction", 9, ""],
    ["A Few Good Men", 7.7, ""],
    ["Mrs. Doubtfire", 8, ""],
    ["Good Morning, Vietnam", 8.3, ""],
    ["Rounders", 7.2, ""],
    ["Detachment", 8.8, "Incredibly deep, hard to rank compared to others"],
    ["Reservoir Dogs", 6.5, ""],
    ["500 Days of Summer", 7, "Really resonates with me"],
    ["Good Will Hunting", 9, ""],
    ["Rocky II", 7, ""],
    ["Rocky", 6.8, ""],
    ["The Ballad of Buster Scruggs", 7.2, ""],
    ["The Wolf of Wall Street", 8.8, ""],
    ["I, Robot", 7.3, ""],
    ["The Curious Case of Benjamin Button", 9.0, ""],
    ["Palm Springs", 8.7, ""],
    ["Fried Green Tomatoes", 8.3, ""],
    ["American Fiction", 7.3, ""],
    ["Obsession", 8.8, ""],
    ["Good Burger", 6.3, ""],
    ["Dune", 8, ""],
    ["Dune: Part Two", 8.5, ""],
    ["Inception", 8.7, ""],
    ["A Dog's Purpose", 8.4, ""],
    ["Blow", 8.2, ""],
    ["Kill Bill: Vol. 1", 8.75, ""],
    ["Kill Bill: Vol. 2", 8.9, ""],
    ["Flight", 8.6, ""],
    ["Major Payne", 6.3, ""],
    ["The Odyssey", 9.3, ""],
    ["Young Adult", 7, ""],
    ["UHF", 7.2, "Funny / weird"],
    ["Hook", 6.8, ""],
    ["The Upside", 8.4, ""],
    ["Seven", 8.1, "Kevin's favorite"]
  ];

  const sheet = moviesSheet();
  toWatchTitles.forEach(function (title) {
    sheet.appendRow([newId(), title, 'towatch', '', '', Date.now()]);
  });
  watched.forEach(function (m) {
    sheet.appendRow([newId(), m[0], 'watched', m[1], m[2], Date.now()]);
  });
}

function seedQuotes() {
  // date is stored as 'YYYY-MM-DD', or '' for undated.
  const quotes = [
    ["A novice who prides himself on his experience does not know the extent of his inexperience", "2025-06-09", ""],
    ["Loving someone is never a waste but a waste is never loving someone", "2025-06-14", "Not Harrison's own quote"],
    ["Everyone craves consistency, but many crave at the expense of advancement", "2025-07-01", ""],
    ["A familiar hell is more comfortable than an unfamiliar heaven", "2025-07-09", ""],
    ["One shan't attempt to grow wheat on scorched earth", "2025-06-20", ""],
    ["Let your promises for tomorrow be what you accomplish today", "2025-07-20", ""],
    ["The people who we rely on the most are the ones we appreciate the least", "2025-08-16", ""],
    ["Enjoy it while it's here, don't miss it before it's gone", "2025-09-19", ""],
    ["If you praise a hobo for his tent, he will never think to look for a house", "2025-10-11", ""],
    ["Success isn't personal accomplishment, it's team achievement", "", ""],
    ["What is wrong but another man's correct", "2025-12-20", ""],
    ["You can bait a fish all day but it won't eat unless it's hungry", "2025-12-21", ""],
    ["You can't force a mole out of its hole unless it wants to see the sunlight", "2026-04-18", ""],
    ["If you're in shallow water you will never have to learn how to swim", "2026-04-19", "Olivier"],
    ["A life without reservation is the only one worth living", "2026-06-15", "At a Buddhist temple in Busan, South Korea"],
    ["People who get mad at ignorance are ignorant themselves", "2026-06-19", ""],
    ["Consistent inaction only leads to disappointment", "2026-07-30", ""]
  ];
  const sheet = quotesSheet();
  quotes.forEach(function (q) {
    sheet.appendRow([newId(), q[0], q[1], q[2], Date.now()]);
  });
}

function seedRecipes() {
  const sheet = recipesSheet();
  function add(name, notes, ingredients, steps, source) {
    sheet.appendRow([newId(), name, notes || '', JSON.stringify(ingredients || []), JSON.stringify(steps || []), source || '', Date.now()]);
  }

  add(
    "Auntie El's Cobbler",
    "Preheat oven to 375°. Place a baking sheet on the lowest oven shelf in case it bubbles over. In a 10\" cast iron skillet, fill with frozen fruit just below the rim, plus the zest and juice of one lemon. In a bowl, cream 1 stick softened/melted butter with 1¼ c sugar. Mix in 1⅓ c self-rising flour (or all-purpose flour + salt + 2 tsp baking powder), ⅓ c rolled oats — mix until it looks like bread crumbs — then ⅔ c any milk, mixed until very sticky (no extra liquid). Add vanilla if desired. Dollop the mixture over the fruit and spread with a butter knife, don't overthink it. Sprinkle ¼ c sugar over the top and wet it well with water (a spray bottle works best) — there should be no dry sugar visible. Bake 45 minutes.",
    [], [], ""
  );

  add(
    "Auntie El's Brownies", "",
    ["2 boxes brownie mix", "4 eggs", "4 oz water", "7 oz oil", "1.5 cups chocolate chips"],
    ["Bake at 350° in a 9×13 pan for 17 min 30 sec, turn the pan, bake another 17 min 30 sec.", "Cool and cut into desired pieces."],
    ""
  );

  add(
    "Shrimp Salad", "",
    ["soy sauce", "mayo", "sriracha", "sesame oil", "sesame seeds", "green onion", "cilantro", "cucumber", "shrimp"],
    [], ""
  );

  add(
    "Chess Squares", "Yield: 2 dozen.",
    ["1 box yellow cake mix", "1 box vanilla pudding", "1 stick butter, softened", "½ cup chopped pecans",
     "1 (8 oz) package cream cheese, softened", "1 (1 lb) box confectioner's sugar", "2 eggs", "½ tsp vanilla"],
    ["Preheat oven to 350°F.", "Cream butter and cake mix by hand.", "Press into a 9\"×11\" pan.",
     "Sprinkle with pecans.", "Mix remaining ingredients with an electric mixer until smooth, pour over the cake mixture.",
     "Bake 40 minutes or until golden brown on top.", "Let cool and cut into squares. Best made a day ahead; can be frozen."],
    ""
  );

  add(
    "Frothed Coffee", "",
    ["1 tbsp instant coffee", "1 tbsp sugar", "2 tbsp water"],
    ["Froth until frothy, then add milk."],
    "Courtesy of Andrew"
  );

  add(
    "No-Knead Bread", "Equipment: cast iron or stainless steel pot.",
    ["400g AP flour", "½ tsp dry yeast", "¾ tbsp (or ½ tbsp) salt", "300ml warm water (100°F)"],
    ["Combine half the flour with the water and yeast, mix.",
     "Add remaining flour and salt, stop mixing once no dry flour remains.",
     "Cover with plastic wrap; rest out of the fridge 6h, then in the fridge at least 10h or overnight.",
     "Turn dough onto a floured bench, fold it onto itself 4 times, cover with a towel, dust with flour, rest 2h at room temp.",
     "After 1h into that rest, preheat pot in oven at 450°F.",
     "Score the top of the dough, place in the pot, bake covered 30 min at 450°F, then uncovered 15 min."],
    ""
  );

  add(
    "Bacon Wrapped Chestnuts",
    "Preheat oven to 400°F. Line a baking sheet with foil or parchment; a wire rack on top helps the bacon crisp.",
    ["2 cans whole water chestnuts (drained, dried)", "1 lb bacon (each slice cut in half)", "toothpicks",
     "Sauce: 1½ c ketchup", "Sauce: 2 tsp yellow mustard", "Sauce: ½ c packed brown sugar",
     "Sauce: vinegar (white or apple cider) to taste", "Sauce: water as needed"],
    ["Wrap each chestnut snugly in bacon, secure with a toothpick, arrange on the rack/tray.",
     "Mix sauce ingredients, stir until smooth.",
     "Bake the wrapped chestnuts until cooked and crispy, then transfer into the sauce and simmer 5–10 minutes before serving."],
    ""
  );

  add(
    "No Smoker Ribs", "",
    ["Rub: 2 tbsp (20g) kosher salt", "Rub: 1 tbsp (12g) light brown sugar", "Rub: 1 tbsp (9g) smoked paprika",
     "Rub: 1 tbsp (10g) garlic powder", "Rub: optional 1 tbsp coffee rib rub",
     "2–4 racks St. Louis-style or baby back ribs", "splash of yuzu rice vinegar (or any vinegar)",
     "Sauce: 1 cup (285g) ketchup", "Sauce: ¼ cup (50g) light brown sugar", "Sauce: 2 tsp (7g) kosher salt",
     "Sauce: 2 tbsp (24g) distilled white vinegar", "Sauce: 2 tbsp (24g) yuzu rice vinegar or apple cider vinegar",
     "Sauce: ½ cup (120g) water", "Sauce: 1 tbsp (10g) garlic powder", "Sauce: 1 tbsp (10g) smoked paprika",
     "Sauce: optional splash of shiro dashi"],
    ["Preheat oven to 300°F. Mix the rub.", "Remove the membrane from the back of the ribs.",
     "Season both sides, place meat-side down on foil, splash with vinegar, wrap tightly.",
     "Bake on a sheet pan 2½–3 hours until tender.",
     "For the sauce, whisk all sauce ingredients in a saucepan, simmer 30 min until slightly thickened, cool.",
     "Finish same-day by broiling meat-side up while brushing with sauce until caramelized, or next-day by grilling on medium-high while basting.",
     "Slice between bones, serve with extra sauce."],
    "Joshua Weissman — Best BBQ Ribs (No Smoker)"
  );

  add(
    "Indian Curry", "",
    ["2 lbs chicken (breast or thighs, or any cut)", "¾–1 medium onion, diced", "1–2 tomatoes", "green Thai chilis",
     "1 tbsp coriander powder", "½ tbsp cumin powder", "1½ tsp garam masala (more to taste at the end)",
     "½ tsp turmeric", "salt to taste", "2 tbsp ginger garlic paste", "optional ½ tsp black pepper"],
    ["Heat 1–2 tbsp oil in a pan.", "Add diced onion and chiles, caramelize the onions.",
     "Add tomatoes, cook until soft, then add ginger garlic paste and cook on medium until the raw smell is gone (about a minute).",
     "Add coriander, cumin, turmeric, and garam masala; fry another 30 seconds until combined.",
     "Add chicken and salt, let it cook.",
     "Once the chicken is coated in the sauce, cover and cook 10–15 minutes, until a sauce forms."],
    "Rishab"
  );

  add(
    "Baked Wings",
    "Link: https://www.recipetineats.com/crispy-oven-baked-chicken-wings-honey-garlic-sauce/#recipe",
    [], [], ""
  );

  add("Broyles Pizza", "", [], [], "");
  add("Alexandra's Cooks Sicilian Pizza", "", [], [], "");

  add(
    "Megan's Baked Ziti", "Note: béchamel sauce recipe to be added separately.",
    [],
    ["Cook 1 lb of beef (Harrison uses spicy Impossible meat)", "Make 1 lb of ziti pasta",
     "Use a jar of Zoro red sauce", "Use a generous amount of mozzarella",
     "Combine everything in a large baking tin"],
    "Megan"
  );

  add(
    "Fufu and Egusi (Egusi Soup)", "",
    ["Chicken: 6 each chicken drums and thighs, cleaned with lemon juice", "Chicken: ½ tsp granulated garlic",
     "Chicken: ¼ tsp cayenne pepper (optional)", "Chicken: 1 tsp salt & ½ tsp black pepper",
     "Chicken: ½ tsp paprika", "Chicken: ½ tsp granulated onion", "Chicken: 1 chicken bouillon/stock cube",
     "Chicken: 1 tbsp olive oil plus extra for grilling",
     "Base: 1 large onion, chopped", "Base: ½ tbsp garlic paste", "Base: 1 tbsp ginger paste",
     "Base: ½ cup smoked herring (for authentic flavor)", "Base: 2 habanero chilis (one left whole, one split open)",
     "Base: 2 small red bell peppers, seeded and blended", "Base: 4 vine tomatoes, seeded and blended",
     "Egusi: 3 cups pumpkin seeds (egusi/pepitas)", "Egusi: ½ cup vegetable broth (optional)",
     "Finish: green leafy vegetable of choice (3 cups chopped kale used)", "Finish: ⅔ cup palm oil (for authentic flavor)"],
    ["Oven-grill the chicken with its seasoning (broil setting) for 12 minutes.",
     "Transfer grilled chicken with its juices into the pot with the base ingredients, cook on medium with the lid on for 10 minutes until a vigorous boil is reached.",
     "Blend the egusi with water (roughly 2½ cups, enough to sit an inch above it), plus ½ cup extra water from rinsing the blender.",
     "Add blended egusi to the pot, cook on low with the lid on for 15 minutes, stir, then cook uncovered another 10–12 minutes, stirring periodically, until oil resettles on top (a sign it's done).",
     "Stir in the leafy greens and palm oil, fold in, cook 5 more minutes, and serve."],
    ""
  );
}

function seedTemplates() {
  const sheet = templatesSheet();
  sheet.appendRow([newId(), 'Book', JSON.stringify([
    { label: 'Title', type: 'text' },
    { label: 'Author', type: 'text' },
    { label: 'Status', type: 'dropdown', options: ['Want to Read', 'Reading', 'Finished'] },
    { label: 'Rating', type: 'rating' },
    { label: 'Date Finished', type: 'date' }
  ])]);
  sheet.appendRow([newId(), 'Wishlist', JSON.stringify([
    { label: 'Item', type: 'text' },
    { label: 'Priority', type: 'dropdown', options: ['Low', 'Medium', 'High'] },
    { label: 'Link', type: 'text' },
    { label: 'Purchased', type: 'checkbox' }
  ])]);
}

// ============================================================
// SETUP STEPS
// 1. Create a new Google Sheet at sheets.new.
// 2. Extensions > Apps Script. Delete the default code, paste in
//    this entire file.
// 3. Click Deploy > New deployment > gear icon > select "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Click Deploy, authorize the permissions it asks for.
// 5. Copy the Web App URL (ends in /exec). Paste it into
//    SCRIPT_URL at the top of index.html.
// 6. Back in the Apps Script editor, select "seedAll" from the
//    function dropdown at the top and click Run once, to populate
//    the Sheet with starting Movies / Quotes / Recipes data and
//    the two example Templates. Authorize if prompted.
// 7. Anytime you edit this code, use Deploy > Manage deployments >
//    edit (pencil) > New version, to push the update live.
// ============================================================
