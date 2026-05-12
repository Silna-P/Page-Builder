app_name = "pagebuilder"
app_title = "Page Builder"
app_publisher = "Silna P"
app_description = "NFC Card and Web Page Builder"
app_email = "silna@fynac.com"
app_license = "MIT"
app_version = "1.0.0"

website_route_rules = [
	{"from_route": "/pagebuilder", "to_route": "pagebuilder"},
	{"from_route": "/cards/<path:route>", "to_route": "nfc_page"},
]

web_include_css = []
web_include_js = []
app_include_css = []
app_include_js = []
