import supabase from "../config/supabaseClient.js";
import multer from "multer";

// Configuración de Multer para documentos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Manejador de errores genérico
const handleError = (res, message, error, status = 500) => {
  console.error(`${message}:`, error.message);
  return res.status(status).json({
    success: false,
    message,
    error: error.message,
  });
};

// Ruta raíz
export const getRoot = (req, res) => {
  res.status(200).json({
    success: true,
    message: "¡El backend está funcionando correctamente!",
  });
};

// Obtener todas las postulaciones
export const getPostulaciones = async (req, res) => {
  try {
    const { numeroDocumento } = req.query;
    let query = supabase.from("Postulaciones").select("*");

    if (numeroDocumento) {
      query = query.eq("numeroDocumento", numeroDocumento);
    }

    const { data, error } = await query;

    if (error) {
      return handleError(res, "Error al obtener datos", error);
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    handleError(res, "Error inesperado", err);
  }
};

// Actualizar check_BD
export const updateCheckBD = async (req, res) => {
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
      return handleError(res, "Error al actualizar check_BD", error);
    }

    res.status(200).json({
      success: true,
      message: "Campo check_BD actualizado correctamente.",
      data,
    });
  } catch (err) {
    handleError(res, "Error inesperado", err);
  }
};

// Actualizar observacion_BD
export const updateObservacionBD = async (req, res) => {
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
      return handleError(res, "Error al actualizar observacion_BD", error);
    }

    res.status(200).json({
      success: true,
      message: "Campo observacion_BD actualizado correctamente.",
      data,
    });
  } catch (err) {
    handleError(res, "Error inesperado", err);
  }
};

// Actualizar estado
export const updateEstado = async (req, res) => {
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
      return handleError(res, "Error al actualizar estado", error);
    }

    res.status(200).json({
      success: true,
      message: "Campo 'estado' actualizado correctamente.",
      data,
    });
  } catch (err) {
    handleError(res, "Error inesperado al actualizar estado", err);
  }
};

// Obtener estadísticas
export const getStats = async (req, res) => {
  try {
    const { data, error } = await supabase.from("Postulaciones").select("*");

    if (error) {
      return handleError(res, "Error al obtener estadísticas", error);
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
      stats: { genderCounts, educationCounts, departmentCounts },
    });
  } catch (err) {
    handleError(res, "Error inesperado", err);
  }
};

// Obtener detalles con filtros
export const getDetails = async (req, res) => {
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
      return handleError(res, "Error al obtener detalles", error);
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    handleError(res, "Error inesperado", err);
  }
};

// Descargar archivos
export const descargarArchivo = async (req, res) => {
  const filePath = req.params[0];
  console.log("Solicitud de descarga recibida - filePath:", filePath);

  if (
    !filePath ||
    (!filePath.startsWith("hojas-vida/") && !filePath.startsWith("documentos/"))
  ) {
    console.error("Ruta de archivo no válida:", filePath);
    return res.status(400).json({
      success: false,
      message: "Ruta de archivo no válida. Debe comenzar con 'hojas-vida/' o 'documentos/'.",
    });
  }

  try {
    let bucket;
    let path;

    if (filePath.startsWith("hojas-vida/")) {
      bucket = "hojas-vida";
      path = `hojas-vida/${
        filePath.startsWith("hojas-vida/hojas-vida/")
          ? filePath.replace("hojas-vida/hojas-vida/", "")
          : filePath.replace("hojas-vida/", "")
      }`;
    } else {
      bucket = "documentos";
      path = filePath.replace("documentos/", "");
    }

    console.log(`Intentando descargar - Bucket: ${bucket}, Path: ${path}`);

    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error) {
      console.error("Error al descargar desde Supabase:", error.message, {
        bucket,
        path,
        filePath,
      });
      return res.status(404).json({
        success: false,
        message: "Archivo no encontrado en el bucket.",
        error: error.message,
        details: { bucket, path, filePath },
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
    handleError(res, "Error interno en /api/descargar", err, 500);
  }
};

// Enviar formulario
export const enviarFormulario = async (req, res) => {
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
      return handleError(res, "Error al verificar el documento", checkError);
    }

    if (existingData.length > 0) {
      return res.status(400).json({
        success: false,
        message: `El número de documento ${numeroDocumento} ya está registrado.`,
      });
    }

    // Sanitizar el nombre del archivo
    let fileName = hojaVidaFile.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.pdf\.pdf$/, ".pdf");
    const timestamp = Date.now();
    const filePath = `hojas-vida/${timestamp}-${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("hojas-vida")
      .upload(filePath, hojaVidaFile.buffer, {
        contentType: hojaVidaFile.mimetype,
      });

    if (uploadError) {
      return handleError(res, "Error al subir el archivo", uploadError);
    }

    const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/hojas-vida/${timestamp}-${fileName}`;
    console.log("URL generada para hojaVida:", hojaVidaURL);

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
      return handleError(res, "Error al guardar los datos", error);
    }

    res.status(200).json({
      success: true,
      message: "Formulario enviado exitosamente",
      data,
    });
  } catch (err) {
    handleError(res, "Error al procesar el formulario", err);
  }
};

// Subir un solo documento
export const subirDocumento = async (req, res) => {
  try {
    const { postulacion_id, tipo, categoria, beneficiarioId } = req.body;
    const archivo = req.file;

    if (!postulacion_id || !tipo || !archivo) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos: postulacion_id, tipo o archivo.",
      });
    }

    const parsedPostulacionId = parseInt(postulacion_id);
    if (isNaN(parsedPostulacionId)) {
      return res.status(400).json({
        success: false,
        message: "El postulacion_id debe ser un número entero válido.",
      });
    }

    const { data: postulacion, error: postulacionError } = await supabase
      .from("Postulaciones")
      .select("id")
      .eq("id", parsedPostulacionId)
      .single();

    if (postulacionError || !postulacion) {
      return handleError(
        res,
        "El postulacion_id proporcionado no es válido o no existe",
        new Error(postulacionError?.message || "No encontrado"),
        400
      );
    }

    const filePath = `documentos/${parsedPostulacionId}_${tipo}_${Date.now()}_${archivo.originalname}`;

    const { data: storageData, error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, archivo.buffer, {
        contentType: archivo.mimetype,
      });

    if (uploadError) {
      return handleError(res, "Error al subir el archivo", uploadError);
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
      return handleError(res, "Error al guardar el documento en la base de datos", insertError);
    }

    res.status(200).json({
      success: true,
      message: "Documento subido y registrado correctamente.",
      url: publicUrl,
    });
  } catch (err) {
    handleError(res, "Error inesperado al procesar el documento", err);
  }
};

// Subir múltiples documentos
export const subirDocumentosMultiples = async (req, res) => {
  try {
    const { postulacion_id, tipos, beneficiarioIds, categorias } = req.body;
    const archivos = req.files;

    if (!postulacion_id || !archivos || !tipos || !categorias) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos: postulacion_id, archivos, tipos o categorias.",
      });
    }

    const parsedPostulacionId = parseInt(postulacion_id);
    if (isNaN(parsedPostulacionId)) {
      return res.status(400).json({
        success: false,
        message: "El postulacion_id debe ser un número entero válido.",
      });
    }

    const tiposArray = Array.isArray(tipos) ? tipos : [tipos];
    const beneficiarioIdsArray = Array.isArray(beneficiarioIds) ? beneficiarioIds : [beneficiarioIds];
    const categoriasArray = Array.isArray(categorias) ? categorias : [categorias];

    if (
      archivos.length !== tiposArray.length ||
      archivos.length !== beneficiarioIdsArray.length ||
      archivos.length !== categoriasArray.length
    ) {
      return res.status(400).json({
        success: false,
        message: "El número de archivos no coincide con el número de tipos, beneficiarioIds o categorias.",
      });
    }

    const { data: postulacion, error: postulacionError } = await supabase
      .from("Postulaciones")
      .select("id")
      .eq("id", parsedPostulacionId)
      .single();

    if (postulacionError || !postulacion) {
      return handleError(
        res,
        "El postulacion_id proporcionado no es válido o no existe",
        new Error(postulacionError?.message || "No encontrado"),
        400
      );
    }

    const mandatoryTypes = ["hoja_vida", "antecedentes_judiciales"];
    const { data: existingDocs, error: docsError } = await supabase
      .from("documentos_postulante")
      .select("tipo")
      .eq("postulacion_id", parsedPostulacionId);

    if (docsError) {
      return handleError(res, "Error al verificar documentos existentes", docsError);
    }

    const uploadedTypes = existingDocs.map((doc) => doc.tipo);
    const newTypes = tiposArray;
    const allTypes = [...new Set([...uploadedTypes, ...newTypes])];

    const missingMandatory = mandatoryTypes.filter((tipo) => !allTypes.includes(tipo));
    if (missingMandatory.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Faltan documentos obligatorios: ${missingMandatory.join(", ")}.`,
      });
    }

    const uploadedDocuments = [];

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      const tipo = tiposArray[i];
      const beneficiarioId = beneficiarioIdsArray[i] === "" ? null : beneficiarioIdsArray[i];
      const categoria = categoriasArray[i] || "principal";

      const filePath = `documentos/${parsedPostulacionId}_${tipo}_${Date.now()}_${archivo.originalname}`;

      const { data: storageData, error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, archivo.buffer, {
          contentType: archivo.mimetype,
        });

      if (uploadError) {
        return handleError(res, `Error al subir el archivo ${archivo.originalname}`, uploadError);
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
        return handleError(
          res,
          `Error al guardar el documento ${archivo.originalname} en la base de datos`,
          insertError
        );
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
    handleError(res, "Error inesperado al procesar los documentos", err);
  }
};

// Eliminar un documento
export const eliminarDocumento = async (req, res) => {
  try {
    const { id } = req.params;

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

    const filePath = documento.url.split("/documentos/")[1];

    const { error: storageError } = await supabase.storage
      .from("documentos")
      .remove([filePath]);

    if (storageError) {
      return handleError(res, "Error al eliminar archivo del almacenamiento", storageError);
    }

    const { error: deleteError } = await supabase
      .from("documentos_postulante")
      .delete()
      .eq("id", parseInt(id));

    if (deleteError) {
      return handleError(res, "Error al eliminar el documento de la base de datos", deleteError);
    }

    res.status(200).json({
      success: true,
      message: "Documento eliminado correctamente.",
    });
  } catch (err) {
    handleError(res, "Error inesperado al eliminar el documento", err);
  }
};

// Exportar multer para usarlo en las rutas
export { upload };