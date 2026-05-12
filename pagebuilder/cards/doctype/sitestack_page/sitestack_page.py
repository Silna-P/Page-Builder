import frappe
import json
import re
from frappe.model.document import Document

class SiteStackPage(Document):
	def validate(self):
		if not self.route:
			frappe.throw("Route is required")
		self.route = self.route.strip("/").lower()
		self.route = re.sub(r"[^a-z0-9\-]", "-", self.route).strip("-")
		existing = frappe.db.get_value(
			"SiteStack Page",
			{"route": self.route, "name": ("!=", self.name)},
			"name",
		)
		if existing:
			frappe.throw(f"Route '/{self.route}' is already used.")

	def get_rendered_html(self):
		settings = {}
		try:
			settings = json.loads(self.settings or "{}")
		except Exception:
			pass

		theme_id = self.theme_id or ""
		if not theme_id:
			return "<p style='padding:20px'>No theme selected.</p>"

		theme_name = frappe.db.get_value("SiteStack Theme", {"theme_id": theme_id}, "name")
		if not theme_name:
			return f"<p style='padding:20px'>Theme '{theme_id}' not found.</p>"

		theme_doc = frappe.get_doc("SiteStack Theme", theme_name)
		html = theme_doc.html_source or ""

		try:
			schema = json.loads(theme_doc.settings_schema or "[]")
		except Exception:
			schema = []

		# Build defaults from schema
		defaults = {}
		for field in schema:
			if isinstance(field, dict) and field.get("key"):
				defaults[field["key"]] = str(field.get("default") or "")

		# Merge: defaults first, then page settings override
		merged = {**defaults, **{k: str(v or "") for k, v in settings.items()}}

		# Replace all {{key}} placeholders
		for key, value in merged.items():
			html = html.replace("{{" + key + "}}", value)

		# Clean remaining unreplaced placeholders
		html = re.sub(r"\{\{[^}]+\}\}", "", html)

		return html
