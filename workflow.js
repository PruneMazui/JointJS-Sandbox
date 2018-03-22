const Config = {
    POSITION_INCREMENT_X: 10,
    POSITION_INCREMENT_Y: 10,
    RECT_WIDTH: 75,
    RECT_HEIGHT: 30
};

let Workflow = {
    type_def: {
        start: {
            text: "Start",
            block_color: "#286090",
            stroke_color: "#204d74",
            source: "single",
            target: false
        },
        normal: {
            text: "Normal",
            block_color: "#5bc0de",
            stroke_color: "#46b8da",
            source: "single",
            target: "single"
        },
        multi_start: {
            text: "Multi Start",
            block_color: "#ec971f",
            stroke_color: "#d58512",
            source: "multiple",
            target: "single"
        },
        multi_end: {
            text: "Multi End",
            block_color: "#ec971f",
            stroke_color: "#d58512",
            source: "single",
            target: "multiple"
        },
        nest: {
            text: "Nest",
            block_color: "#ec971f",
            stroke_color: "#d58512",
            source: "single",
            target: "single",
            canCreate: function() {
                return $("#nest_wf_id").val().length > 0;
            },
            beforeCreate: function(work) {
                let text = work.prop("attrs/text/text");
                let wk_id = $("#nest_wf_id").val();
                text += "\n[" + wk_id + "]";
                work.prop("attrs/text/text", text);
                work.wk_id = wk_id;

                let size = work.prop("size");
                size.height += Config.RECT_HEIGHT / 2;
                size.width += Config.RECT_WIDTH / 2;
                work.prop("size", size);

                return work;
            },
            onCreated: function() {
                $("#nest_wf_id").val("");
            }
        },
        end: {
            text: "End",
            block_color: "#286090",
            stroke_color: "#204d74",
            source: false,
            target: "single"
        }
    },

    position: { x: 50, y: 50 }
};

$(function() {
    //=============================================================
    // グラフ作成
    graph = (() => {
        let graph = new joint.dia.Graph() || {};
        graph.resetSelect = function() {
            $(this.getCells()).each(function(k, v) {
                if (typeof v.changeSelect == "function") {
                    v.changeSelect(false);
                }
            });
        };

        graph.type_count = {};

        // ワークの追加
        graph.createWork = function(data_type) {
            let type_def = Workflow.type_def;
            let target = type_def[data_type];

            if (typeof target.canCreate == "function") {
                if (!target.canCreate()) {
                    return false;
                }
            }

            if (!graph.type_count[data_type]) {
                graph.type_count[data_type] = 0;
            }
            graph.type_count[data_type]++;

            let work = new joint.shapes.basic.Rect({
                position: Workflow.position,
                size: { width: Config.RECT_WIDTH, height: Config.RECT_HEIGHT },
                attrs: {
                    rect: {
                        fill: target.block_color,
                        stroke: target.stroke_color,
                        "stroke-width": 2,
                        rx: "4px",
                        ry: "4px"
                    },
                    text: {
                        text: target.text + graph.type_count[data_type],
                        fill: "#ffffff",
                        "font-size": 14
                    }
                }
            });

            work.type = data_type;
            work.name = target.text + graph.type_count[data_type];

            work.changeSelect = function(isSelect) {
                work.prop(
                    "attrs/rect/stroke",
                    isSelect ? "#f00" : type_def[work.type].stroke_color
                );
            };

            if (typeof target.beforeCreate == "function") {
                work = target.beforeCreate(work);
                if (work === null || work === false) {
                    return false;
                }
            }

            Workflow.position.x += Config.POSITION_INCREMENT_X;
            Workflow.position.y += Config.POSITION_INCREMENT_Y;

            this.addCell(work);

            if (typeof target.onCreated == "function") {
                target.onCreated(work);
            }

            return true;
        };

        graph.getCurrentConnection = function() {
            let connection = {};
            $.each(this.getLinks(), function(k, v) {
                let source_id = v.prop("source/id");

                if (!connection[source_id]) {
                    connection[source_id] = [];
                }

                connection[source_id].push(v.prop("target/id"));
            });

            return connection;
        };

        // コネクションが貼れるか返す
        graph._canConnection = function(source, target) {
            if (source.id == target.id) {
                return false;
            }

            let source_pattern = Workflow.type_def[source.type]["source"];
            let target_pattern = Workflow.type_def[target.type]["target"];

            if (source_pattern === false) {
                return false;
            }

            if (target_pattern === false) {
                return false;
            }

            // 接続元がシングルで既に接続済みの場合 false
            let current_connection = this.getCurrentConnection();
            if (source_pattern === "single") {
                if (current_connection[source.id]) {
                    return false;
                }
            }

            // 接続先がシングルで既に接続済みの場合 false
            if (target_pattern === "single") {
                let exist_flg = false;

                $.each(current_connection, function(i, targets) {
                    $.each(targets, function(j, v) {
                        if (v == target.id) {
                            exist_flg = true;
                            return false;
                        }
                    });

                    if (exist_flg) {
                        return false;
                    }
                });

                if (exist_flg) {
                    return false;
                }
            }

            // 既に同じ接続、逆向きがある場合 false
            if (
                current_connection[source.id] &&
                current_connection[source.id].indexOf(target.id) >= 0
            ) {
                return false;
            }

            if (
                current_connection[target.id] &&
                current_connection[target.id].indexOf(source.id) >= 0
            ) {
                return false;
            }

            return true;
        };

        // コネクションを貼る
        graph.addConnection = function(source, target) {
            if (!this._canConnection(source, target)) {
                return false;
            }

            let link = new joint.dia.Link({
                source: { id: source.id },
                target: { id: target.id },
                router: { name: "manhattan" },
                connector: { name: "rounded" },
                z: -1,
                attrs: {
                    ".connection": {
                        stroke: "#333333",
                        "stroke-width": 3
                    },
                    ".marker-target": {
                        fill: "#333333",
                        d: "M 10 0 L 0 5 L 10 10 z"
                    }
                }
            });

            this.addCell(link);

            return true;
        };

        return graph;
    })();

    //=============================================================
    // ペーパー
    let paper = (() => {
        return new joint.dia.Paper({
            el: $("#workarea"),
            width: "auto",
            height: 800,
            gridSize: 10,
            model: graph
        });
    })();

    //=============================================================
    // 各種イベント
    let updateLinks = function() {
        $(graph.getLinks()).each(function(k, v) {
            paper.findViewByModel(v).update();
        });
    };

    // 移動イベント
    graph.on("change:position", updateLinks);

    // 追加ボタンイベント
    $(".add_work").on("click", function() {
        graph.createWork($(this).data("type"));
        updateLinks();
    });

    // シフトキーの状態を保持
    let is_shift = false;
    $(window).on("keydown", function(ev) {
        is_shift = ev.shiftKey;
    });

    $(window).on("keyup", function(ev) {
        is_shift = ev.shiftKey;

        // deleteキー
        if (ev.keyCode == 46) {
            $(".delete_work").trigger("click");
        }
    });

    // work操作
    let selected = null;

    paper.on("cell:pointerclick", function(cell) {
        graph.resetSelect();
        if (cell.model.prop("type") == "basic.Rect") {
            if (is_shift && selected != null) {
                if (graph.addConnection(selected, cell.model)) {
                    selected = null;
                    return;
                }
            }
            cell.model.changeSelect(true);
            selected = cell.model;
        }
    });

    // 何もないところをクリックしたら選択を外す
    paper.on("blank:pointerclick", function() {
        graph.resetSelect();
        selected = null;
    });

    $(".delete_work").on("click", function() {
        if (selected != null) {
            selected.remove();
        }
        selected = null;
    });

    // JSON生成
    $("#generate").on("click", function() {
        let result = {};
        let connection = graph.getCurrentConnection();

        let type_count = {};
        let replace_maps = {};

        $.each(connection, function(source_id, targets) {
            $.each(targets, function(k, target_id) {
                $.each([source_id, target_id], function(k, id) {
                    if (!result[id]) {
                        let cell = graph.getCell(id);
                        let type = cell.type;
                        result[id] = {
                            type: cell.type,
                            next: [],
                            prev: []
                        };

                        if (cell.wk_id) {
                            result[id]["wk_id"] = cell.wk_id;
                        }

                        if (!type_count[type]) {
                            type_count[type] = 0;
                        }
                        type_count[type]++;

                        replace_maps[id] =
                            "__" + type.toUpperCase() + type_count[type];
                    }
                });

                if (result[source_id]["next"].indexOf(target_id) < 0) {
                    result[source_id]["next"].push(target_id);
                }

                if (result[target_id]["prev"].indexOf(source_id) < 0) {
                    result[target_id]["prev"].push(source_id);
                }
            });
        });

        // バリデーション
        let messages = [];

        $.each(graph.getCells(), function(k, cell) {
            if (!cell.type) {
                return;
            }

            if (!result[cell.id]) {
                messages.push(cell.name + " が接続されていません");
            }
        });

        $.each(result, function(id, row_result) {
            let cell = graph.getCell(id);
            let def = Workflow.type_def[cell.type];
            if (def.target !== false && row_result.prev.length <= 0) {
                messages.push(cell.name + " の接続元が指定されていません");
            }

            if (def.source !== false && row_result.next.length <= 0) {
                messages.push(cell.name + " の接続先が指定されていません");
            }
        });

        if (messages.length > 0) {
            $("#error-messages").text("");
            $.each(messages, function(k, msg) {
                $("<li></li>")
                    .html(msg)
                    .appendTo($("#error-messages"));
            });
            $("#error-modal").modal("show");
            return;
        }

        let json = JSON.stringify(result);
        let json_format = JSON.stringify(result, null, "    ");

        $.each(replace_maps, function(key, value) {
            let regex = new RegExp(key, "g");
            json_format = json_format.replace(regex, value);
            json = json.replace(regex, value);
        });

        $("#generated-result").text(json_format);
        $("#generated-json").text(json);

        $("#generated-modal").modal("show");
    });

    //============================================================
    // その他イベント

    // コピーボタン
    var clipboard = new ClipboardJS("#generated-copy");

    clipboard.on("success", function(e) {
        $('#copy-result').show();
        setTimeout(function() {
            $('#copy-result').fadeOut('slow');
        }, 500);
        e.clearSelection();
    });

    //=============================================================
    // 初期配置
    graph.createWork("start");
});
