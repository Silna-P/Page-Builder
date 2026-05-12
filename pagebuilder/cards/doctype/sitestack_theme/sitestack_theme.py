import frappe
import json
import re
from frappe.model.document import Document


class SiteStackTheme(Document):
	def before_save(self):
		if not self.theme_id and self.theme_name:
			self.theme_id = re.sub(r"[^a-z0-9]+", "-", self.theme_name.lower()).strip("-")
		if self.settings_schema:
			try:
				schema = json.loads(self.settings_schema)
				if not isinstance(schema, list):
					frappe.throw("Settings Schema must be a JSON array.")
			except (json.JSONDecodeError, TypeError):
				frappe.throw("Settings Schema must be valid JSON.")
