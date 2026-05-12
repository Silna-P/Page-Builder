import frappe
import json
from frappe import _


@frappe.whitelist()
def get_pages():
	pages = frappe.db.sql("""
		SELECT name, page_name, route, published, theme_id, settings, modified
		FROM `tabSiteStack Page`
		ORDER BY modified DESC
	""", as_dict=True)
	for p in pages:
		try:
			p["settings"] = json.loads(p.get("settings") or "{}")
		except Exception:
			p["settings"] = {}
	return pages


@frappe.whitelist()
def save_page(name=None, route=None, published=1, theme_id=None, settings=None, page_name=None):
	if not route:
		frappe.throw(_("Route is required"))
	settings_str = settings if isinstance(settings, str) else json.dumps(settings or {})
	if name and frappe.db.exists("SiteStack Page", name):
		doc = frappe.get_doc("SiteStack Page", name)
		doc.route = route
		doc.published = int(published)
		doc.theme_id = theme_id or ""
		doc.settings = settings_str
		if page_name:
			doc.page_name = page_name
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.new_doc("SiteStack Page")
		doc.page_name = page_name or route
		doc.route = route
		doc.published = int(published)
		doc.theme_id = theme_id or ""
		doc.settings = settings_str
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.name


@frappe.whitelist()
def delete_page(name):
	if not frappe.db.exists("SiteStack Page", name):
		frappe.throw(_("Page not found"), frappe.DoesNotExistError)
	frappe.delete_doc("SiteStack Page", name, ignore_permissions=True)
	frappe.db.commit()
	return {"success": True}


@frappe.whitelist()
def get_custom_themes():
	themes = frappe.db.sql("""
		SELECT name, theme_name, theme_id, category,
		       accent_color, description, html_source, settings_schema
		FROM `tabSiteStack Theme`
		ORDER BY modified DESC
	""", as_dict=True)
	result = []
	for t in themes:
		try:
			schema = json.loads(t.settings_schema or "[]")
		except Exception:
			schema = []
		result.append({
			"id": t.theme_id or t.name,
			"name": t.theme_name or t.name,
			"description": t.description or "",
			"category": t.category or "NFC Card",
			"color": t.accent_color or "#6c63ff",
			"htmlSource": t.html_source or "",
			"schema": schema,
			"type": "custom",
		})
	return result


@frappe.whitelist()
def save_custom_theme(theme_id, theme_data):
	data = theme_data if isinstance(theme_data, dict) else json.loads(theme_data)
	existing = frappe.db.get_value("SiteStack Theme", {"theme_id": theme_id}, "name")
	if existing:
		doc = frappe.get_doc("SiteStack Theme", existing)
	else:
		doc = frappe.new_doc("SiteStack Theme")
		doc.theme_id = theme_id
	doc.theme_name = data.get("name", theme_id)
	doc.category = data.get("category", "NFC Card")
	doc.accent_color = data.get("color", "#6c63ff")
	doc.description = data.get("description", "")
	doc.html_source = data.get("htmlSource", "")
	doc.settings_schema = json.dumps(data.get("schema", []))
	if existing:
		doc.save(ignore_permissions=True)
	else:
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return {"success": True, "theme_id": theme_id}


@frappe.whitelist()
def delete_custom_theme(theme_id):
	existing = frappe.db.get_value("SiteStack Theme", {"theme_id": theme_id}, "name")
	if existing:
		frappe.delete_doc("SiteStack Theme", existing, ignore_permissions=True)
		frappe.db.commit()
	return {"success": True}


@frappe.whitelist(allow_guest=True)
def get_page_by_route(route):
	route = route.strip("/").lower()
	name = frappe.db.get_value("SiteStack Page", {"route": route, "published": 1}, "name")
	if not name:
		frappe.throw(_("Page not found"), frappe.DoesNotExistError)
	doc = frappe.get_doc("SiteStack Page", name)
	return {
		"name": doc.name,
		"route": doc.route,
		"theme_id": doc.theme_id,
		"settings": json.loads(doc.settings or "{}"),
	}
