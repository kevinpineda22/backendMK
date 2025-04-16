import express from "express";
import multer from "multer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Configuración de Multer para documentos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
});

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    optionsSuccessStatus: 200,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta raíz
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "¡El backend está funcionando correctamente!",
  });
});

// Endpoint para obtener todas las postulaciones
app.get("/api/postulaciones", async (req, res) => {
  try {
    const { numeroDocumento } = req.query;
    let query = supabase.from("Postulaciones").select("*");

    if (numeroDocumento) {
      query = query.eq("numeroDocumento", numeroDocumento);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al obtener datos:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al obtener datos",
        error: error.message,
      });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado",
      error: err.message,
    });
  }
});

// Endpoint para actualizar check_BD
app.patch("/api/postulaciones/:id/check", async (req, res) => {
  try {
    const { id } = req.params;
    const { check_BD } = req.body;

    if (typeof check_BD !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "El campo check_BD debe ser un valor booleano.",
      });
    }

    const { data, error } = await supabase
      .from("Postulaciones")
      .update({ check_BD })
      .eq("id", parseInt(id))
      .select();

    if (error) {
      console.error("Error al actualizar check_BD:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al actualizar el campo check_BD.",
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Campo check_BD actualizado correctamente.",
      data,
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado",
      error: err.message,
    });
  }
});

// Endpoint para actualizar observacion_BD
app.patch("/api/postulaciones/:id/observacion", async (req, res) => {
  try {
    const { id } = req.params;
    const { observacion_BD } = req.body;

    if (typeof observacion_BD !== "string") {
      return res.status(400).json({
        success: false,
        message: "El campo observacion_BD debe ser un valor de texto.",
      });
    }

    const { data, error } = await supabase
      .from("Postulaciones")
      .update({ observacion_BD })
      .eq("id", parseInt(id))
      .select();

    if (error) {
      console.error("Error al actualizar observacion_BD:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al actualizar el campo observacion_BD.",
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Campo observacion_BD actualizado correctamente.",
      data,
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado",
      error: err.message,
    });
  }
});

// Endpoint para actualizar estado
app.patch("/api/postulaciones/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || typeof estado !== "string") {
      return res.status(400).json({
        success: false,
        message: "El campo 'estado' es obligatorio y debe ser texto.",
      });
    }

    const { data, error } = await supabase
      .from("Postulaciones")
      .update({ estado })
      .eq("id", parseInt(id))
      .select();

    if (error) {
      console.error("Error al actualizar estado:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al actualizar el campo estado.",
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Campo 'estado' actualizado correctamente.",
      data,
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado al actualizar estado.",
      error: err.message,
    });
  }
});

// Endpoint para estadísticas
app.get("/api/postulaciones/stats", async (req, res) => {
  try {
    const { data, error } = await supabase.from("Postulaciones").select("*");

    if (error) {
      console.error("Error al obtener estadísticas:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al obtener estadísticas",
        error: error.message,
      });
    }

    const genderCounts = data.reduce((acc, curr) => {
      acc[curr.genero] = (acc[curr.genero] || 0) + 1;
      return acc;
    }, {});

    const educationCounts = data.reduce((acc, curr) => {
      acc[curr.nivelEducativo] = (acc[curr.nivelEducativo] || 0) + 1;
      return acc;
    }, {});

    const departmentCounts = data.reduce((acc, curr) => {
      acc[curr.Departamento] = (acc[curr.Departamento] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      stats: {
        genderCounts,
        educationCounts,
        departmentCounts,
      },
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado",
      error: err.message,
    });
  }
});

// Endpoint para detalles con filtros
app.get("/api/postulaciones/details", async (req, res) => {
  try {
    const { filterText } = req.query;

    let query = supabase.from("Postulaciones").select("*");

    if (filterText) {
      query = query.or(
        `nombreApellido.ilike.%${filterText}%,Ciudad.ilike.%${filterText}%,Departamento.ilike.%${filterText}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al obtener detalles:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al obtener detalles",
        error: error.message,
      });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado",
      error: err.message,
    });
  }
});

// Descargar archivos
app.get("/api/descargar/*", async (req, res) => {
  const filePath = req.params[0];
  console.log("Solicitud de descarga recibida - filePath:", filePath);

  if (
    !filePath ||
    (!filePath.startsWith("hojas-vida/") && !filePath.startsWith("documentos/"))
  ) {
    console.error("Ruta de archivo no válida:", filePath);
    return res.status(400).json({
      success: false,
      message:
        "Ruta de archivo no válida. Debe comenzar con 'hojas-vida/' o 'documentos/'.",
    });
  }

  try {
    const bucket = filePath.startsWith("hojas-vida/")
      ? "hojas-vida"
      : "documentos";
    const path = filePath.replace(/^(hojas-vida|documentos)\//, "");
    console.log(`Descargando desde bucket: ${bucket}, path: ${path}`);

    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error) {
      console.error("Error al descargar desde Supabase:", error.message, {
        bucket,
        path,
      });
      return res.status(400).json({
        success: false,
        message:
          "No se pudo descargar el archivo. Es posible que no exista o no sea accesible.",
        error: error.message,
        details: { bucket, path }, // Add detailed error context
      });
    }

    console.log("Archivo descargado exitosamente:", path);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.split("/").pop()}"`
    );
    const buffer = Buffer.from(await data.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error("Error interno en /api/descargar:", err.message, {
      filePath,
    });
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al procesar la descarga.",
      error: err.message,
      details: { filePath }, // Add detailed error context
    });
  }
});

// Enviar formulario
app.post("/enviar", upload.single("hojaVida"), async (req, res) => {
  try {
    const {
      fechaPostulacion,
      nombreApellido,
      nivelEducativo,
      cargo,
      telefono,
      genero,
      Departamento,
      Ciudad,
      zonaResidencia,
      barrio,
      fechaNacimiento,
      tipoDocumento,
      numeroDocumento,
      recomendado,
      observacion_BD,
    } = req.body;

    const hojaVidaFile = req.file;

    if (!hojaVidaFile) {
      return res
        .status(400)
        .json({ success: false, message: "La hoja de vida es obligatoria." });
    }
    if (!numeroDocumento) {
      return res.status(400).json({
        success: false,
        message: "El número de documento es obligatorio.",
      });
    }

    const { data: existingData, error: checkError } = await supabase
      .from("Postulaciones")
      .select("id")
      .eq("numeroDocumento", numeroDocumento)
      .limit(1);

    if (checkError) {
      console.error("Error al verificar:", checkError.message);
      return res.status(500).json({
        success: false,
        message: "Error al verificar el documento.",
        error: checkError.message,
      });
    }

    if (existingData.length > 0) {
      return res.status(400).json({
        success: false,
        message: `El número de documento ${numeroDocumento} ya está registrado.`,
      });
    }

    const filePath = `hojas-vida/${Date.now()}-${hojaVidaFile.originalname}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("hojas-vida")
      .upload(filePath, hojaVidaFile.buffer, {
        contentType: hojaVidaFile.mimetype,
      });

    if (uploadError) {
      console.error("Error al subir:", uploadError.message);
      return res.status(500).json({
        success: false,
        message: "Error al subir el archivo.",
        error: uploadError.message,
      });
    }

    const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/${filePath}`;

    const { data, error } = await supabase
      .from("Postulaciones")
      .insert([
        {
          fechaPostulacion,
          nombreApellido,
          nivelEducativo,
          cargo,
          telefono,
          genero,
          Departamento,
          Ciudad,
          zonaResidencia,
          barrio,
          fechaNacimiento,
          tipoDocumento,
          numeroDocumento,
          recomendado,
          hojaVida: hojaVidaURL,
          check_BD: false,
          observacion_BD,
        },
      ])
      .select();

    if (error) {
      console.error("Error al insertar:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al guardar los datos.",
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Formulario enviado exitosamente",
      data,
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error al procesar el formulario",
      error: err.message,
    });
  }
});

// Subir un solo documento
app.post("/api/documentos", upload.single("archivo"), async (req, res) => {
  try {
    const { postulacion_id, tipo, categoria, beneficiarioId } = req.body;
    const archivo = req.file;

    if (!postulacion_id || !tipo || !archivo) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos: postulacion_id, tipo o archivo.",
      });
    }

    // Convertir postulacion_id a entero
    const parsedPostulacionId = parseInt(postulacion_id);
    if (isNaN(parsedPostulacionId)) {
      return res.status(400).json({
        success: false,
        message: "El postulacion_id debe ser un número entero válido.",
      });
    }

    // Validar que postulacion_id existe
    const { data: postulacion, error: postulacionError } = await supabase
      .from("Postulaciones")
      .select("id")
      .eq("id", parsedPostulacionId)
      .single();

    if (postulacionError || !postulacion) {
      console.error(
        "Error al verificar postulacion_id:",
        postulacionError?.message || "No encontrado"
      );
      return res.status(400).json({
        success: false,
        message: "El postulacion_id proporcionado no es válido o no existe.",
      });
    }

    const filePath = `documentos/${parsedPostulacionId}_${tipo}_${Date.now()}_${
      archivo.originalname
    }`;

    const { data: storageData, error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, archivo.buffer, {
        contentType: archivo.mimetype,
      });

    if (uploadError) {
      console.error("Error al subir el archivo:", uploadError.message);
      return res.status(500).json({
        success: false,
        message: "Error al subir el archivo.",
        error: uploadError.message,
      });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos/${filePath}`;

    const { error: insertError } = await supabase
      .from("documentos_postulante")
      .insert({
        postulacion_id: parsedPostulacionId,
        tipo,
        categoria: categoria || "principal",
        url: publicUrl,
        beneficiarioid: beneficiarioId || null,
      });

    if (insertError) {
      console.error("Error al guardar documento:", insertError.message);
      return res.status(500).json({
        success: false,
        message: "Error al guardar el documento en la base de datos.",
        error: insertError.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Documento subido y registrado correctamente.",
      url: publicUrl,
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado al procesar el documento.",
      error: err.message,
    });
  }
});

// Subir múltiples documentos
app.post(
  "/api/documentos/multiple",
  upload.array("archivos"),
  async (req, res) => {
    try {
      const { postulacion_id, tipos, beneficiarioIds, categorias } = req.body;
      const archivos = req.files;

      if (!postulacion_id || !archivos || !tipos || !categorias) {
        return res.status(400).json({
          success: false,
          message:
            "Faltan campos requeridos: postulacion_id, archivos, tipos o categorias.",
        });
      }

      // Convertir postulacion_id a entero
      const parsedPostulacionId = parseInt(postulacion_id);
      if (isNaN(parsedPostulacionId)) {
        return res.status(400).json({
          success: false,
          message: "El postulacion_id debe ser un número entero válido.",
        });
      }

      // Convertir a arrays si no lo son
      const tiposArray = Array.isArray(tipos) ? tipos : [tipos];
      const beneficiarioIdsArray = Array.isArray(beneficiarioIds)
        ? beneficiarioIds
        : [beneficiarioIds];
      const categoriasArray = Array.isArray(categorias)
        ? categorias
        : [categorias];

      if (
        archivos.length !== tiposArray.length ||
        archivos.length !== beneficiarioIdsArray.length ||
        archivos.length !== categoriasArray.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "El número de archivos no coincide con el número de tipos, beneficiarioIds o categorias.",
        });
      }

      // Validar que postulacion_id existe
      const { data: postulacion, error: postulacionError } = await supabase
        .from("Postulaciones")
        .select("id")
        .eq("id", parsedPostulacionId)
        .single();

      if (postulacionError || !postulacion) {
        console.error(
          "Error al verificar postulacion_id:",
          postulacionError?.message || "No encontrado"
        );
        return res.status(400).json({
          success: false,
          message: "El postulacion_id proporcionado no es válido o no existe.",
        });
      }

      // Validar documentos obligatorios
      const mandatoryTypes = ["hoja_vida", "antecedentes_judiciales"];
      const { data: existingDocs, error: docsError } = await supabase
        .from("documentos_postulante")
        .select("tipo")
        .eq("postulacion_id", parsedPostulacionId);

      if (docsError) {
        console.error(
          "Error al obtener documentos existentes:",
          docsError.message
        );
        return res.status(500).json({
          success: false,
          message: "Error al verificar documentos existentes.",
          error: docsError.message,
        });
      }

      const uploadedTypes = existingDocs.map((doc) => doc.tipo);
      const newTypes = tiposArray;
      const allTypes = [...new Set([...uploadedTypes, ...newTypes])];

      const missingMandatory = mandatoryTypes.filter(
        (tipo) => !allTypes.includes(tipo)
      );
      if (missingMandatory.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan documentos obligatorios: ${missingMandatory.join(
            ", "
          )}.`,
        });
      }

      const uploadedDocuments = [];

      for (let i = 0; i < archivos.length; i++) {
        const archivo = archivos[i];
        const tipo = tiposArray[i];
        const beneficiarioId =
          beneficiarioIdsArray[i] === "" ? null : beneficiarioIdsArray[i];
        const categoria = categoriasArray[i] || "principal";

        const filePath = `documentos/${parsedPostulacionId}_${tipo}_${Date.now()}_${
          archivo.originalname
        }`;

        const { data: storageData, error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(filePath, archivo.buffer, {
            contentType: archivo.mimetype,
          });

        if (uploadError) {
          console.error(
            `Error al subir archivo ${archivo.originalname}:`,
            uploadError.message
          );
          return res.status(500).json({
            success: false,
            message: `Error al subir el archivo ${archivo.originalname}.`,
            error: uploadError.message,
          });
        }

        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos/${filePath}`;

        const { data: insertedDoc, error: insertError } = await supabase
          .from("documentos_postulante")
          .insert({
            postulacion_id: parsedPostulacionId,
            tipo,
            categoria,
            url: publicUrl,
            beneficiarioid: beneficiarioId,
          })
          .select()
          .single();

        if (insertError) {
          console.error(
            `Error al guardar documento ${archivo.originalname}:`,
            insertError.message
          );
          return res.status(500).json({
            success: false,
            message: `Error al guardar el documento ${archivo.originalname} en la base de datos.`,
            error: insertError.message,
          });
        }

        uploadedDocuments.push({
          id: insertedDoc.id,
          tipo,
          url: publicUrl,
          beneficiarioid: beneficiarioId,
        });
      }

      res.status(200).json({
        success: true,
        message: `${uploadedDocuments.length} documento(s) subido(s) y registrado(s) correctamente.`,
        data: uploadedDocuments,
      });
    } catch (err) {
      console.error("Error inesperado en /api/documentos/multiple:", err);
      res.status(500).json({
        success: false,
        message: "Error inesperado al procesar los documentos.",
        error: err.message,
      });
    }
  }
);

// Eliminar un documento
app.delete("/api/documentos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el documento para eliminar el archivo del almacenamiento
    const { data: documento, error: fetchError } = await supabase
      .from("documentos_postulante")
      .select("url")
      .eq("id", parseInt(id))
      .single();

    if (fetchError || !documento) {
      return res.status(404).json({
        success: false,
        message: "Documento no encontrado.",
      });
    }

    // Extraer el nombre del archivo desde la URL
    const filePath = documento.url.split("/documentos/")[1];

    // Eliminar el archivo del almacenamiento
    const { error: storageError } = await supabase.storage
      .from("documentos")
      .remove([filePath]);

    if (storageError) {
      console.error(
        "Error al eliminar archivo del almacenamiento:",
        storageError.message
      );
      return res.status(500).json({
        success: false,
        message: "Error al eliminar el archivo del almacenamiento.",
        error: storageError.message,
      });
    }

    // Eliminar el registro de la base de datos
    const { error: deleteError } = await supabase
      .from("documentos_postulante")
      .delete()
      .eq("id", parseInt(id));

    if (deleteError) {
      console.error("Error al eliminar documento:", deleteError.message);
      return res.status(500).json({
        success: false,
        message: "Error al eliminar el documento de la base de datos.",
        error: deleteError.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Documento eliminado correctamente.",
    });
  } catch (err) {
    console.error("Error inesperado:", err.message);
    res.status(500).json({
      success: false,
      message: "Error inesperado al eliminar el documento.",
      error: err.message,
    });
  }
});

// Exportar para Vercel
export default app;

// Escuchar solo en desarrollo local
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7777;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}
