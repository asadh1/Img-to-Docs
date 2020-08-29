function onOpen(e) {
	DocumentApp.getUi().createAddonMenu()
		.addItem('Start', 'showSidebar')
		.addToUi();
}

function onInstall(e) {
	onOpen(e);
}

function showSidebar() {
	var ui = HtmlService.createHtmlOutputFromFile('sidebar')
		.setTitle('Img to Docs');
	DocumentApp.getUi().showSidebar(ui);
}

var fakeCursor;
var doc;

function insertLine(txt, brk) {
	doc = DocumentApp.getActiveDocument();
	var selection = doc.getSelection();
	var bullet = txt.startsWith('* ');
	if (bullet) {
		txt = txt.substring(2)
	};

	function insertAtCursor() {
		if (bullet) {
			insertBullet(txt);
		} else {
			if (brk) {
				if (fakeCursor == null) {
					throw new Error("Can't insert with only the end of the paragraph selected, please unselect and try again");
				}
				var el = fakeCursor.getElement();
				var parentElement = el.getParent();
				var childIndex = parentElement.getChildIndex(el);
				var p = parentElement.insertParagraph(childIndex + 1, txt.substring(1));
				fakeCursor = doc.newPosition(p, 1);
			} else {
				if (fakeCursor == null) {
					throw new Error("Can't insert with only the end of the paragraph selected, please unselect and try again");
				}
				var surroundingText = fakeCursor.getSurroundingText().getText();
				var surroundingTextOffset = fakeCursor.getSurroundingTextOffset();

				if (surroundingTextOffset > 0) {
					if (surroundingText.charAt(surroundingTextOffset - 1) != ' ') {
						txt = ' ' + txt;
					}
				}

				if (surroundingTextOffset < surroundingText.length) {
					if (surroundingText.charAt(surroundingTextOffset) != ' ') {
						txt += ' ';
					}
				}
				fakeCursor.insertText(txt);
				var txtEl = fakeCursor.getElement();
				var txtOff = fakeCursor.getOffset();
				fakeCursor = doc.newPosition(txtEl, txtOff + 1);
			}
		}
	}
	if (selection) {
		var cleared = false;
		var elements = selection.getSelectedElements();
		if (elements.length === 1 && elements[0].getElement().getType() ===
			DocumentApp.ElementType.INLINE_IMAGE) {
			throw new Error('Can\'t insert text into an image.');
		}
		for (var i = 0; i < elements.length; ++i) {
			if (elements[i].isPartial()) {
				var element = elements[i].getElement().asText();
				fakeCursor = doc.newPosition(element, elements[i].getStartOffset());
				if (!cleared) {
					var startIndex = elements[i].getStartOffset();
					var endIndex = elements[i].getEndOffsetInclusive();
					element.deleteText(startIndex, endIndex);
					cleared = true;
				} else {
					var parent = element.getParent();
					var remainingText = element.getText().substring(endIndex + 1);
					parent.getPreviousSibling().asText().appendText(remainingText);
					if (parent.getNextSibling()) {
						parent.removeFromParent();
					} else {
						element.removeFromParent();
					}
				}
			} else {
				var element = elements[i].getElement();
				fakeCursor = doc.newPosition(element, 0);
				if (!cleared && element.editAsText) {
					element.clear();
					cleared = true;
				} else {
					if (element.getNextSibling()) {
						element.removeFromParent();
					} else {
						element.clear();
					}
				}
			}
		}
		doc.setCursor(fakeCursor);
		insertAtCursor();
	} else {
		insertAtCursor();
	}
}

function insertBullet(txt) {
	var el = fakeCursor.getElement(),
		offset = fakeCursor.getOffset();

	var inParagraph = (el.getType() == DocumentApp.ElementType.PARAGRAPH || el.getType() == DocumentApp.ElementType.LIST_ITEM);

	if (!inParagraph && (el.getType() != DocumentApp.ElementType.TEXT)) {
		throw new Error("Position must be inside text or paragraph.");
	}

	var par;
	if (inParagraph) {
		par = el;
		if (offset == par.getNumChildren()) {
			var bullet = par.getParent().insertListItem(par.getParent().getChildIndex(par) + 1, txt).setGlyphType(DocumentApp.GlyphType.BULLET);
			fakeCursor = doc.newPosition(bullet, 1);
			return bullet;
		}
		el = par.getChild(offset);
	} else {
		par = el.getParent();
		if (par == null || (par.getType() != DocumentApp.ElementType.PARAGRAPH && par.getType() != DocumentApp.ElementType.LIST_ITEM)) {
			throw new Error("Cursor must be within a paragraph or a list.");
		}
	}

	var parContainer = par.getParent();

	if (!("insertParagraph" in parContainer)) {
		throw new Error("Cannot insert another paragraph in this container.");
	}

	var elIndex = par.getChildIndex(el);
	var newPar = par.copy();

	var newEl = newPar.getChild(elIndex);

	if (!inParagraph && (offset != 0)) {
		newEl.deleteText(0, offset - 1);
	}
	newEl = newEl.getPreviousSibling();
	while (newEl != null) {
		var prevEl = newEl.getPreviousSibling();
		newEl.removeFromParent();
		newEl = prevEl;
	}

	var nextEl = el.getNextSibling();

	if (!inParagraph && (offset != 0)) {
		el.deleteText(offset, el.getText().length - 1);
	} else {
		el.removeFromParent();
	}

	el = nextEl;
	while (el != null) {
		nextEl = el.getNextSibling();
		el.removeFromParent();
		el = nextEl;
	}

	switch (par.getType()) {
		case DocumentApp.ElementType.PARAGRAPH:
			parContainer.insertParagraph(parContainer.getChildIndex(par) + 1, newPar);
			break;
		case DocumentApp.ElementType.LIST_ITEM:
			parContainer.insertListItem(parContainer.getChildIndex(par) + 1, newPar);
			break;
	}
	var finalParent = newPar.getParent();
	var bullet = finalParent.insertListItem(finalParent.getChildIndex(newPar), txt).setGlyphType(DocumentApp.GlyphType.BULLET);
	fakeCursor = doc.newPosition(bullet, 1);
}

function insertText(txt) {
	doc = DocumentApp.getActiveDocument();
	fakeCursor = doc.getCursor()
	var lines = txt.split('\n');

	if (lines[lines.length - 1] == '') {
		lines.pop();
	}

	for (i = 0; i < lines.length; i++) {
		var line = lines[i];
		var brk = false;
		if (i != 0 && !line.startsWith('* ') && line != '') {
			line = '\n' + line;
			if (lines[i - 1].startsWith('* ')) {
				brk = true;
			}
		}
		if (line != '') {
			insertLine(line, brk);
		} else if (i != 0) {
			insertLine('\n', brk);
		}
	}
	if (lines.length > 0) {
		doc.setCursor(fakeCursor);
	}
}
