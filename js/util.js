// Dumb MVC
const vars = {};
function Var(name) {
	if (vars[name])
		throw new Error(`A variable with name ${name} already exists!`);

	this.name = name;
	this.listeners = [];
	this.value = null;
	this.updating = false;

	vars[name] = this;
}
// Register listener
Var.prototype.on = function(handler) {
	this.listeners.push(handler);

	return this;
}
// Update value
Var.prototype.update = function(value) {
	// Ignore updates that don't change the current value
	if (this.value === value)
		return false;

	this.value = value;

	if (this.updating) {
		console.error('Loop in update');
		return false;
	}

	// Notify listeners
	this.updating = true;
	for (const listener of this.listeners) {
		try {
			listener.call(this, value);
		} catch (e) {
			console.error(e);
		}
	}
	this.updating = false;

	return true;
}
