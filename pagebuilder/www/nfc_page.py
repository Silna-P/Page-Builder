import frappe
no_cache = 1
def get_context(context):
	path = frappe.local.request.path.strip("/")
	if path.startswith("cards/"):
		path = path[6:]
	name = frappe.db.get_value("SiteStack Page", {"route": path, "published": 1}, "name")
	if not name:
		frappe.throw("Page not found", frappe.DoesNotExistError)
	doc = frappe.get_doc("SiteStack Page", name)
	context.page_html = doc.get_rendered_html()
	context.title = doc.page_name or path
	context.no_cache = 1
	context.show_sidebar = False
