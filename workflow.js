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
                console.log($("#nest_wf_id").val());
                console.log(work);
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

        // ワークの追加
        graph.createWork = function(data_type) {
            let type_def = Workflow.type_def;
            let target = type_def[data_type];

            if (typeof target.canCreate == "function") {
                if (!target.canCreate()) {
                    return false;
                }
            }

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
                        text: target.text,
                        fill: "#ffffff",
                        "font-size": 14
                    }
                }
            });

            work.type = data_type;
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
                connection[v.prop("source/id")] = v.prop("target/id");
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

                $.each(current_connection, function(k, v) {
                    if (v == target.id) {
                        exist_flg = true;
                        return false;
                    }
                });

                if (exist_flg) {
                    return false;
                }
            }

            // 既に同じ接続、逆向きがある場合 false
            if (current_connection[source.id] == target.id) {
                return false;
            }

            if (current_connection[target.id] == source.id) {
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

    //=============================================================
    // 初期配置
    graph.createWork("start");
});
