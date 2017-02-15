(function() {
	var dateElems = document.getElementsByClassName("isoDateStr");
	for(var i = 0; i < dateElems.length; i++) {
		var date = new Date(dateElems[i].innerText);
		dateElems[i].innerText = date.toLocaleString();
	}
})();
