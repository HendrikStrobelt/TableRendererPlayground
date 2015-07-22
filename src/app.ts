
import d3 = require('d3');
import $ = require('jquery');
import table = require('./table');

$("#go").click(function () {
    var text = $("#text").val();
    $.getJSON("myservice?text=" + encodeURIComponent(text), (data) => {
        $("#output").text(data.reversed);
    });
});

var tangeloProvider = new table.TangeloProvider("server/tableProvider", "music");
var generatorProvider = new table.GeneratorProvider(10, 100000);
var testTable = new table.Element("testTable", generatorProvider);

console.log("test");